import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type DropAnimation,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import AddListForm from '../components/board/AddListForm';
import BoardActionsMenu from '../components/board/BoardActionsMenu';
import BoardActivityMenu from '../components/board/BoardActivityMenu';
import BoardArchiveMenu from '../components/board/BoardArchiveMenu';
import BoardBackgroundMenu from '../components/board/BoardBackgroundMenu';
import BoardFilterPanel from '../components/board/BoardFilterPanel';
import BoardMembers from '../components/board/BoardMembers';
import CardModal from '../components/board/CardModal';
import CardItem from '../components/board/CardItem';
import ListColumn from '../components/board/ListColumn';
import ListColumnOverlay from '../components/board/ListColumnOverlay';
import ShortcutsHelp from '../components/board/ShortcutsHelp';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useBoards } from '../context/BoardsContext';
import StarButton from '../components/StarButton';
import type { BoardOutletContext } from '../layouts/BoardViewLayout';
import {
  addBoardMember,
  changeMemberRole,
  fetchBoard,
  fetchBoardMembers,
  removeBoardMember,
  updateBoard,
} from '../lib/api/board';
import { archiveCard, createCard, moveCard, updateCard } from '../lib/api/card';
import {
  archiveList,
  copyList,
  createList,
  deleteAllCards,
  fetchBoardLists,
  moveAllCards,
  reorderList,
  sortListCards,
  updateList,
  type SortListBy,
} from '../lib/api/list';
import { assetUrl } from '../lib/assets';
import { socket } from '../lib/socket';
import { pushRecentBoard } from '../lib/recentBoards';
import { getErrorMessage } from '../lib/errorMessage';
import {
  EMPTY_FILTER,
  cardMatchesFilter,
  filterActiveCount,
  isFilterActive,
  type BoardFilter,
} from '../lib/boardFilter';
import type { Board, BoardMember, BoardVisibility } from '../types/board';
import BoardVisibilityMenu from '../components/board/BoardVisibilityMenu';
import type { Card } from '../types/card';
import type { BoardList } from '../types/list';

function listIdFromDnd(id: string): string | null {
  return id.startsWith('list-') ? id.slice('list-'.length) : null;
}

// Hieu ung khi tha: ban goc mo dan trong luc "ban noi" bay ve cho -> muot hon
const dropAnimation: DropAnimation = {
  duration: 200,
  easing: 'cubic-bezier(0.2, 0, 0, 1)',
  sideEffects: defaultDropAnimationSideEffects({
    styles: { active: { opacity: '0.35' } },
  }),
};

// Khi keo 1 CỘT: chi xet va cham voi cac cot khac (bo qua the ben trong)
// -> "over" luon la 1 cot, hoat hinh + tha dung. Keo the thi giu mac dinh.
const collisionDetectionStrategy: CollisionDetection = (args) => {
  if (args.active.data.current?.type === 'list') {
    return closestCorners({
      ...args,
      droppableContainers: args.droppableContainers.filter((c) =>
        String(c.id).startsWith('list-')
      ),
    });
  }
  return closestCorners(args);
};

type DeleteTarget =
  | { kind: 'list'; list: BoardList }
  | { kind: 'cards-in-list'; list: BoardList }
  | null;

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { boards, isLoading, error, patchBoard } =
    useOutletContext<BoardOutletContext>();
  const { toggleStar, removeBoard } = useBoards();
  const memberBoard = boards.find((b) => b.id === boardId);

  // Bang cong khai ma minh chua phai thanh vien -> tai truc tiep theo id
  const [fetchedBoard, setFetchedBoard] = useState<Board | null>(null);
  const [fetchBoardError, setFetchBoardError] = useState<string | null>(null);
  useEffect(() => {
    if (!boardId || memberBoard || isLoading) return;
    let alive = true;
    setFetchedBoard(null);
    setFetchBoardError(null);
    fetchBoard(boardId)
      .then((b) => alive && setFetchedBoard(b))
      .catch(
        (err) =>
          alive &&
          setFetchBoardError(
            getErrorMessage(err, 'Bạn không có quyền xem bảng này.')
          )
      );
    return () => {
      alive = false;
    };
  }, [boardId, memberBoard, isLoading]);

  const board = memberBoard ?? fetchedBoard ?? undefined;
  const canEdit = Boolean(memberBoard) || fetchedBoard?.canEdit === true;

  // Ghi nho bang vua mo cho muc "Truy cap nhanh" o Trang chu
  useEffect(() => {
    if (board?.id) pushRecentBoard(board.id);
  }, [board?.id]);
  const readOnly = board != null && !canEdit;
  const isOwner = Boolean(board && user && board.ownerId === user.id);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const [members, setMembers] = useState<BoardMember[]>([]);
  const canManageBoard =
    isOwner ||
    members.find((m) => m.userId === user?.id)?.role === 'ADMIN';

  const [lists, setLists] = useState<BoardList[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [listsError, setListsError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);
  const [bgMenuOpen, setBgMenuOpen] = useState(false);
  const [visMenuOpen, setVisMenuOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [filter, setFilter] = useState<BoardFilter>(EMPTY_FILTER);
  const [filterOpen, setFilterOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [boardMenuOpen, setBoardMenuOpen] = useState(false);

  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [activeList, setActiveList] = useState<BoardList | null>(null);

  // Cho realtime: dang keo-tha thi hoan refetch de khoi giat
  const draggingRef = useRef(false);
  const pendingReloadRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function reloadLists() {
    if (boardId) fetchBoardLists(boardId).then(setLists).catch(() => {});
  }

  useEffect(() => {
    if (!boardId) return;
    setMembers([]);
    fetchBoardMembers(boardId)
      .then(setMembers)
      .catch(() => {});
  }, [boardId]);

  async function handleAddMember(email: string, role: 'ADMIN' | 'MEMBER') {
    if (!boardId) return;
    const created = await addBoardMember(boardId, email, role);
    setMembers((cur) =>
      cur.some((m) => m.userId === created.userId)
        ? cur.map((m) => (m.userId === created.userId ? created : m))
        : [...cur, created]
    );
  }

  async function handleChangeMemberRole(
    userId: string,
    role: 'ADMIN' | 'MEMBER'
  ) {
    if (!boardId) return;
    const prev = members;
    setMembers((cur) =>
      cur.map((m) => (m.userId === userId ? { ...m, role } : m))
    );
    try {
      const updated = await changeMemberRole(boardId, userId, role);
      setMembers((cur) =>
        cur.map((m) => (m.userId === userId ? updated : m))
      );
    } catch (err) {
      setMembers(prev);
      setListsError(getErrorMessage(err, 'Không đổi được vai trò.'));
    }
  }

  async function handleSetVisibility(v: BoardVisibility) {
    if (!board) return;
    try {
      const updated = await updateBoard(board.id, { visibility: v });
      patchBoard(updated);
      if (fetchedBoard) setFetchedBoard({ ...fetchedBoard, visibility: v });
    } catch (err) {
      setListsError(getErrorMessage(err, 'Không đổi được khả năng hiển thị.'));
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!boardId) return;
    const prev = members;
    setMembers((cur) => cur.filter((m) => m.userId !== userId));
    try {
      await removeBoardMember(boardId, userId);
    } catch (err) {
      setMembers(prev);
      setListsError(getErrorMessage(err, 'Không xoá được thành viên.'));
    }
  }

  useEffect(() => {
    if (!boardId) return;
    setLists([]);
    setListsLoading(true);
    setListsError(null);
    fetchBoardLists(boardId)
      .then(setLists)
      .catch((err) =>
        setListsError(getErrorMessage(err, 'Không tải được danh sách.'))
      )
      .finally(() => setListsLoading(false));
  }, [boardId]);

  // ---------- Realtime: đồng bộ khi người khác thay đổi bảng ----------
  useEffect(() => {
    if (!boardId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const doReloadLists = () => {
      // Đang kéo-thả -> hoãn lại, chạy sau khi thả tay
      if (draggingRef.current) {
        pendingReloadRef.current = true;
        return;
      }
      fetchBoardLists(boardId).then(setLists).catch(() => {});
    };

    const onListsChanged = () => {
      clearTimeout(timer);
      timer = setTimeout(doReloadLists, 400); // gộp nhiều sự kiện liên tiếp
    };
    const onMembersChanged = () => {
      fetchBoardMembers(boardId).then(setMembers).catch(() => {});
    };
    const onMetaChanged = () => {
      fetchBoard(boardId)
        .then((b) => {
          patchBoard(b);
          setFetchedBoard((prev) => (prev ? b : prev));
        })
        .catch(() => {});
    };
    const onRemoved = (payload: { boardId?: string }) => {
      if (payload?.boardId === boardId) navigate('/', { replace: true });
    };
    // Mất kết nối rồi nối lại: vào phòng lại + tải bù dữ liệu
    const onConnect = () => {
      socket.emit('join-board', boardId);
      onMembersChanged();
      onListsChanged();
    };

    socket.emit('join-board', boardId);
    socket.on('board:lists-changed', onListsChanged);
    socket.on('board:members-changed', onMembersChanged);
    socket.on('board:meta-changed', onMetaChanged);
    socket.on('board:removed', onRemoved);
    socket.on('connect', onConnect);

    return () => {
      clearTimeout(timer);
      socket.emit('leave-board', boardId);
      socket.off('board:lists-changed', onListsChanged);
      socket.off('board:members-changed', onMembersChanged);
      socket.off('board:meta-changed', onMetaChanged);
      socket.off('board:removed', onRemoved);
      socket.off('connect', onConnect);
    };
  }, [boardId, navigate, patchBoard]);

  // ---------- Phím tắt ----------
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const typing =
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable);
      if (typing) return;

      // '?' luôn dùng được (kể cả khi mở thẻ)
      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }
      // Đang mở modal thẻ hoặc bảng phím tắt -> bỏ qua các phím còn lại
      if (openCardId || shortcutsOpen) return;

      switch (e.key.toLowerCase()) {
        case 'n': {
          e.preventDefault();
          const btn = document.querySelector<HTMLButtonElement>('[data-add-card]');
          btn?.scrollIntoView({ block: 'nearest', inline: 'center' });
          btn?.click();
          break;
        }
        case 'f':
          e.preventDefault();
          setFilterOpen((v) => !v);
          break;
        case 'b':
          e.preventDefault();
          if (!readOnly) setBgMenuOpen((v) => !v);
          break;
        case 'x':
          e.preventDefault();
          setFilter(EMPTY_FILTER);
          break;
        case 'q':
          e.preventDefault();
          setFilter((f) => ({
            ...EMPTY_FILTER,
            ...f,
            assignedToMe: !f.assignedToMe,
          }));
          break;
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [openCardId, shortcutsOpen, readOnly]);

  const listDndIds = useMemo(() => lists.map((l) => `list-${l.id}`), [lists]);

  // Ap dung bo loc -> danh sach the hien thi (khong dong toi state that)
  const filterOn = isFilterActive(filter);
  const displayLists = useMemo(
    () =>
      filterOn
        ? lists.map((l) => ({
            ...l,
            cards: l.cards.filter((c) =>
              cardMatchesFilter(c, filter, user?.id)
            ),
          }))
        : lists,
    [filterOn, lists, filter, user?.id]
  );

  function findListIdByCard(cardId: string): string | undefined {
    return lists.find((l) => l.cards.some((c) => c.id === cardId))?.id;
  }

  // ---------- Ten bang ----------
  async function saveName() {
    if (!board) return;
    const name = draft.trim();
    setEditing(false);
    if (!name || name === board.name) return;
    try {
      patchBoard(await updateBoard(board.id, { name }));
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Không đổi được tên bảng.'));
    }
  }
  function onNameKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') saveName();
    if (e.key === 'Escape') setEditing(false);
  }
  function onNameSubmit(e: FormEvent) {
    e.preventDefault();
    saveName();
  }

  // ---------- Them / doi ten danh sach & the ----------
  async function handleAddList(name: string) {
    if (!boardId) return;
    const created = await createList(boardId, name);
    setLists((cur) => [...cur, { ...created, cards: [] }]);
  }

  async function handleRenameList(listId: string, name: string) {
    setLists((cur) => cur.map((l) => (l.id === listId ? { ...l, name } : l)));
    try {
      await updateList(listId, { name });
    } catch (err) {
      setListsError(getErrorMessage(err, 'Không đổi được tên danh sách.'));
      reloadLists();
    }
  }

  async function handleAddCard(listId: string, title: string) {
    const created = await createCard(listId, title);
    setLists((cur) =>
      cur.map((l) =>
        l.id === listId ? { ...l, cards: [...l.cards, created] } : l
      )
    );
  }

  // ---------- Menu "..." cua danh sach ----------
  async function handleCopyList(list: BoardList) {
    try {
      const created = await copyList(list.id);
      setLists((cur) => {
        const at = cur.findIndex((l) => l.id === list.id);
        const next = [...cur];
        next.splice(at + 1, 0, created);
        return next;
      });
    } catch (err) {
      setListsError(getErrorMessage(err, 'Không sao chép được danh sách.'));
    }
  }

  async function handleMoveList(list: BoardList, to: 'start' | 'end') {
    const position = to === 'start' ? 0 : lists.length - 1;
    const oldIndex = lists.findIndex((l) => l.id === list.id);
    if (oldIndex === -1 || oldIndex === position) return;
    setLists((cur) => arrayMove(cur, oldIndex, position));
    try {
      await reorderList(list.id, position);
    } catch (err) {
      setListsError(getErrorMessage(err, 'Không di chuyển được danh sách.'));
      reloadLists();
    }
  }

  async function handleMoveAllCards(list: BoardList, targetListId: string) {
    try {
      await moveAllCards(list.id, targetListId);
      reloadLists();
    } catch (err) {
      setListsError(getErrorMessage(err, 'Không di chuyển được thẻ.'));
    }
  }

  async function handleSortList(list: BoardList, by: SortListBy) {
    try {
      await sortListCards(list.id, by);
      reloadLists();
    } catch (err) {
      setListsError(getErrorMessage(err, 'Không sắp xếp được danh sách.'));
    }
  }

  function patchCard(updated: Card) {
    setLists((cur) =>
      cur.map((l) => ({
        ...l,
        cards: l.cards.map((c) => (c.id === updated.id ? updated : c)),
      }))
    );
  }

  async function handleToggleCardDone(card: Card) {
    patchCard({ ...card, isDone: !card.isDone });
    try {
      patchCard(await updateCard(card.id, { isDone: !card.isDone }));
    } catch (err) {
      patchCard(card); // hoan tac
      setListsError(getErrorMessage(err, 'Không cập nhật được thẻ.'));
    }
  }

  // Luu tru the (co the khoi phuc trong "Mục đã lưu trữ")
  async function handleArchiveCard(card: Card) {
    setLists((cur) =>
      cur.map((l) => ({
        ...l,
        cards: l.cards.filter((c) => c.id !== card.id),
      }))
    );
    try {
      await archiveCard(card.id);
    } catch (err) {
      setListsError(getErrorMessage(err, 'Không lưu trữ được thẻ.'));
      reloadLists();
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === 'list') {
        await archiveList(deleteTarget.list.id);
        setLists((cur) => cur.filter((l) => l.id !== deleteTarget.list.id));
      } else {
        await deleteAllCards(deleteTarget.list.id);
        setLists((cur) =>
          cur.map((l) =>
            l.id === deleteTarget.list.id ? { ...l, cards: [] } : l
          )
        );
      }
      setDeleteTarget(null);
    } catch (err) {
      setListsError(getErrorMessage(err, 'Thao tác không thành công.'));
    } finally {
      setDeleting(false);
    }
  }

  // ---------- Keo tha ----------
  function endDragCursor() {
    document.body.style.cursor = '';
  }

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    const type = active.data.current?.type;
    draggingRef.current = true;
    document.body.style.cursor = 'grabbing';
    if (type === 'list') {
      const id = listIdFromDnd(active.id as string);
      setActiveList(lists.find((l) => l.id === id) ?? null);
    } else if (type === 'card') {
      const listId = findListIdByCard(active.id as string);
      const card = lists
        .find((l) => l.id === listId)
        ?.cards.find((c) => c.id === active.id);
      setActiveCard(card ?? null);
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over || active.data.current?.type !== 'card') return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const fromListId = findListIdByCard(activeId);
    const toListId =
      over.data.current?.type === 'card'
        ? findListIdByCard(overId)
        : (listIdFromDnd(overId) ?? undefined);

    if (!fromListId || !toListId || fromListId === toListId) return;

    setLists((prev) => {
      const fromList = prev.find((l) => l.id === fromListId);
      const toList = prev.find((l) => l.id === toListId);
      if (!fromList || !toList) return prev;
      const moving = fromList.cards.find((c) => c.id === activeId);
      if (!moving) return prev;

      const overIndex =
        over.data.current?.type === 'card'
          ? toList.cards.findIndex((c) => c.id === overId)
          : toList.cards.length;
      const insertAt = overIndex >= 0 ? overIndex : toList.cards.length;

      return prev.map((l) => {
        if (l.id === fromListId) {
          return { ...l, cards: l.cards.filter((c) => c.id !== activeId) };
        }
        if (l.id === toListId) {
          const next = [...l.cards];
          next.splice(insertAt, 0, { ...moving, listId: toListId });
          return { ...l, cards: next };
        }
        return l;
      });
    });
  }

  function afterDragSettled() {
    draggingRef.current = false;
    if (pendingReloadRef.current) {
      pendingReloadRef.current = false;
      if (boardId) fetchBoardLists(boardId).then(setLists).catch(() => {});
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const type = active.data.current?.type;
    setActiveCard(null);
    setActiveList(null);
    endDragCursor();
    afterDragSettled();
    if (!over) return;

    // ---- Sap xep lai cot ----
    if (type === 'list') {
      const overListId =
        listIdFromDnd(over.id as string) ??
        (over.data.current?.type === 'card'
          ? (over.data.current.listId as string)
          : null);
      const oldIndex = lists.findIndex((l) => `list-${l.id}` === active.id);
      const newIndex = lists.findIndex((l) => l.id === overListId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const reordered = arrayMove(lists, oldIndex, newIndex);
      setLists(reordered);
      try {
        await reorderList(reordered[newIndex]!.id, newIndex);
      } catch (err) {
        setListsError(getErrorMessage(err, 'Không lưu được thứ tự danh sách.'));
        reloadLists();
      }
      return;
    }

    // ---- Keo tha the ----
    if (type === 'card') {
      const activeId = active.id as string;
      const overId = over.id as string;
      const toListId =
        over.data.current?.type === 'card'
          ? findListIdByCard(overId)
          : (listIdFromDnd(overId) ?? undefined);
      if (!toListId) return;

      const toList = lists.find((l) => l.id === toListId);
      if (!toList) return;

      const oldIndex = toList.cards.findIndex((c) => c.id === activeId);
      const overIndex =
        over.data.current?.type === 'card'
          ? toList.cards.findIndex((c) => c.id === overId)
          : toList.cards.length - 1;
      const newIndex = overIndex >= 0 ? overIndex : toList.cards.length - 1;

      let finalIndex = oldIndex;
      if (oldIndex !== -1 && oldIndex !== newIndex) {
        const reorderedCards = arrayMove(toList.cards, oldIndex, newIndex);
        finalIndex = reorderedCards.findIndex((c) => c.id === activeId);
        setLists((prev) =>
          prev.map((l) =>
            l.id === toListId ? { ...l, cards: reorderedCards } : l
          )
        );
      } else if (oldIndex === -1) {
        finalIndex = toList.cards.length;
      }

      try {
        await moveCard(activeId, { listId: toListId, position: finalIndex });
      } catch (err) {
        setListsError(getErrorMessage(err, 'Không di chuyển được thẻ.'));
        reloadLists();
      }
    }
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-500">Đang tải bảng...</div>;
  }
  if (error) {
    return <div className="p-6 text-sm text-red-600">{error}</div>;
  }
  if (!board) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-600">
          {fetchBoardError ??
            (memberBoard === undefined && !fetchedBoard
              ? 'Đang mở bảng...'
              : 'Không tìm thấy bảng này.')}
        </p>
        <Link
          to="/"
          className="mt-2 inline-block text-sm font-medium text-[#0c66e4] hover:underline"
        >
          ← Về danh sách bảng
        </Link>
      </div>
    );
  }

  const canvasStyle = board.backgroundImage
    ? {
        backgroundImage: `url(${assetUrl(board.backgroundImage)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { backgroundColor: board.color };

  return (
    <div className="flex h-full flex-col" style={canvasStyle}>
      {/* Thanh ten bang */}
      <div className="flex shrink-0 items-center gap-2 bg-gradient-to-b from-black/35 to-black/5 px-4 py-2 backdrop-blur-sm">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-white/20 text-white">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
            <rect x="3" y="4" width="8" height="16" rx="1" />
            <rect x="13" y="4" width="8" height="10" rx="1" />
          </svg>
        </span>
        {editing && !readOnly ? (
          <form onSubmit={onNameSubmit}>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={onNameKeyDown}
              className="rounded bg-white px-2 py-1 text-lg font-bold text-slate-900 focus:outline-none"
            />
          </form>
        ) : (
          <button
            type="button"
            disabled={readOnly}
            onClick={() => {
              setDraft(board.name);
              setEditing(true);
            }}
            className="rounded px-2 py-1 text-lg font-bold text-white drop-shadow-sm enabled:hover:bg-white/20"
          >
            {board.name}
          </button>
        )}

        {!readOnly && (
          <StarButton
            starred={Boolean(board.isStarred)}
            onToggle={() => toggleStar(board.id)}
            className={`rounded p-1 ${
              board.isStarred ? '' : 'text-white hover:bg-white/20'
            }`}
          />
        )}

        {canManageBoard && (
          <div className="relative">
            <button
              type="button"
              data-visibility-trigger
              onClick={() => setVisMenuOpen((v) => !v)}
              title="Khả năng hiển thị"
              className="flex items-center gap-1 rounded bg-white/25 px-2 py-1 text-xs font-medium text-white hover:bg-white/40"
            >
              {board.visibility === 'PUBLIC' ? (
                <>
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
                  </svg>
                  Công khai
                </>
              ) : board.visibility === 'WORKSPACE' ? (
                <>
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 8a3 3 0 100-6 3 3 0 000 6zM3 20a6 6 0 0112 0M17 8a3 3 0 100-6M15 20a6 6 0 019-5" />
                  </svg>
                  Không gian làm việc
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="4" y="11" width="16" height="10" rx="2" />
                    <path d="M8 11V7a4 4 0 018 0v4" />
                  </svg>
                  Riêng tư
                </>
              )}
            </button>
            {visMenuOpen && (
              <BoardVisibilityMenu
                value={board.visibility}
                onChange={handleSetVisibility}
                onClose={() => setVisMenuOpen(false)}
              />
            )}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
              data-filter-trigger
              onClick={() => setFilterOpen((v) => !v)}
              className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium ${
                filterOn
                  ? 'bg-white text-[#0c66e4]'
                  : 'bg-white/25 text-white hover:bg-white/40'
              }`}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 5h18M6 12h12M10 19h4" />
              </svg>
              Lọc
              {filterOn && (
                <span className="grid h-4 min-w-[16px] place-items-center rounded-full bg-[#0c66e4] px-1 text-[10px] font-bold text-white">
                  {filterActiveCount(filter)}
                </span>
              )}
            </button>
            {filterOpen && (
              <BoardFilterPanel
                boardId={board.id}
                filter={filter}
                onChange={setFilter}
                boardMembers={members}
                onClose={() => setFilterOpen(false)}
              />
            )}
          </div>

          <div className="relative">
            <button
              type="button"
              data-activity-trigger
              onClick={() => setActivityOpen((v) => !v)}
              title="Hoạt động"
              className="flex items-center gap-1.5 rounded bg-white/25 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-white/40"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4l3 2" />
                <circle cx="12" cy="12" r="9" />
              </svg>
              Hoạt động
            </button>
            {activityOpen && (
              <BoardActivityMenu
                boardId={board.id}
                onClose={() => setActivityOpen(false)}
              />
            )}
          </div>

          {!readOnly && (
            <div className="relative">
              <button
                type="button"
                data-archive-trigger
                onClick={() => setArchiveOpen((v) => !v)}
                title="Mục đã lưu trữ"
                className="flex items-center gap-1.5 rounded bg-white/25 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-white/40"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="4" rx="1" />
                  <path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8M10 12h4" />
                </svg>
                Đã lưu trữ
              </button>
              {archiveOpen && (
                <BoardArchiveMenu
                  boardId={board.id}
                  onClose={() => setArchiveOpen(false)}
                  onChanged={reloadLists}
                />
              )}
            </div>
          )}

          {!readOnly && (
            <div className="relative">
              <button
                type="button"
                data-bg-trigger
                onClick={() => setBgMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded bg-white/25 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-white/40"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="16" rx="2" />
                  <circle cx="9" cy="10" r="2" />
                  <path d="M21 16l-5-5-4 4-2-2-4 4" />
                </svg>
                Hình nền
              </button>
              {bgMenuOpen && (
                <BoardBackgroundMenu
                  board={board}
                  onChanged={patchBoard}
                  onClose={() => setBgMenuOpen(false)}
                />
              )}
            </div>
          )}

          {!readOnly && (
            <BoardMembers
              boardId={board.id}
              members={members}
              currentUserId={user?.id}
              isOwner={isOwner}
              onAdd={handleAddMember}
              onChangeRole={handleChangeMemberRole}
              onRemove={handleRemoveMember}
              onApproved={(member) =>
                setMembers((cur) =>
                  cur.some((m) => m.userId === member.userId)
                    ? cur.map((m) => (m.userId === member.userId ? member : m))
                    : [...cur, member]
                )
              }
            />
          )}

          {!readOnly && (
            <div className="relative">
              <button
                type="button"
                data-board-menu-trigger
                onClick={() => setBoardMenuOpen((v) => !v)}
                title="Thao tác với bảng"
                className="rounded bg-white/25 p-1.5 text-white hover:bg-white/40"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <circle cx="5" cy="12" r="1.8" />
                  <circle cx="12" cy="12" r="1.8" />
                  <circle cx="19" cy="12" r="1.8" />
                </svg>
              </button>
              {boardMenuOpen && (
                <BoardActionsMenu
                  boardId={board.id}
                  boardName={board.name}
                  isOwner={isOwner}
                  onClose={() => setBoardMenuOpen(false)}
                  onArchived={() => {
                    setBoardMenuOpen(false);
                    removeBoard(board.id);
                    navigate('/', { replace: true });
                  }}
                  onDeleted={() => {
                    setBoardMenuOpen(false);
                    removeBoard(board.id);
                    navigate('/', { replace: true });
                  }}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {readOnly && (
        <div className="mx-3 mt-2 flex w-fit items-center gap-2 rounded bg-white/90 px-3 py-1 text-sm text-slate-700 shadow-sm">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="11" width="16" height="10" rx="2" />
            <path d="M8 11V7a4 4 0 018 0v4" />
          </svg>
          Bảng công khai — bạn đang xem ở chế độ chỉ đọc
        </div>
      )}

      {(saveError || listsError) && (
        <p className="mx-4 mt-2 w-fit rounded bg-red-600/90 px-3 py-1 text-sm text-white">
          {saveError ?? listsError}
        </p>
      )}

      {filterOn && (
        <div className="mx-3 mt-2 flex w-fit items-center gap-2 rounded bg-white/90 px-3 py-1 text-sm text-slate-700 shadow-sm">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 5h18M6 12h12M10 19h4" />
          </svg>
          Đang lọc thẻ
          <button
            type="button"
            onClick={() => setFilter(EMPTY_FILTER)}
            className="rounded bg-slate-200 px-2 py-0.5 text-xs font-medium hover:bg-slate-300"
          >
            Xoá bộ lọc
          </button>
        </div>
      )}

      {/* Hang cac danh sach */}
      {listsLoading ? (
        <p className="m-4 w-fit rounded bg-white/80 px-3 py-2 text-sm text-slate-600">
          Đang tải danh sách...
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setActiveCard(null);
            setActiveList(null);
            endDragCursor();
            afterDragSettled();
          }}
        >
          <div
            className={`board-scroll flex min-h-0 flex-1 items-start gap-3 overflow-x-auto p-3 ${
              activeCard || activeList ? 'select-none' : ''
            }`}
          >
            <SortableContext
              items={listDndIds}
              strategy={horizontalListSortingStrategy}
            >
              {displayLists.map((list) => (
                <ListColumn
                  key={list.id}
                  list={list}
                  allLists={lists}
                  readOnly={readOnly}
                  onRename={handleRenameList}
                  onRequestDeleteList={(l) =>
                    setDeleteTarget({ kind: 'list', list: l })
                  }
                  onAddCard={handleAddCard}
                  onToggleCardDone={handleToggleCardDone}
                  onRequestDeleteCard={handleArchiveCard}
                  onOpenCard={setOpenCardId}
                  onCopyList={handleCopyList}
                  onMoveList={handleMoveList}
                  onMoveAllCards={handleMoveAllCards}
                  onSortList={handleSortList}
                  onRequestDeleteAllCards={(l) =>
                    setDeleteTarget({ kind: 'cards-in-list', list: l })
                  }
                />
              ))}
            </SortableContext>

            {!readOnly && <AddListForm onAdd={handleAddList} />}
          </div>

          <DragOverlay dropAnimation={dropAnimation}>
            {activeCard ? (
              <div className="w-64">
                <CardItem card={activeCard} overlay />
              </div>
            ) : activeList ? (
              <ListColumnOverlay list={activeList} />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title={
          deleteTarget?.kind === 'cards-in-list'
            ? 'Xoá tất cả thẻ?'
            : 'Lưu trữ danh sách?'
        }
        message={
          deleteTarget?.kind === 'cards-in-list'
            ? `Toàn bộ ${deleteTarget.list.cards.length} thẻ trong danh sách "${deleteTarget.list.name}" sẽ bị xoá.`
            : deleteTarget?.kind === 'list'
              ? `Danh sách "${deleteTarget.list.name}" (và các thẻ bên trong) sẽ được chuyển vào mục Đã lưu trữ. Bạn có thể khôi phục lại sau.`
              : undefined
        }
        confirmLabel={
          deleteTarget?.kind === 'cards-in-list'
            ? 'Xoá tất cả thẻ'
            : 'Lưu trữ'
        }
        danger={deleteTarget?.kind === 'cards-in-list'}
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />

      {openCardId && (
        <CardModal
          cardId={openCardId}
          lists={lists.map((l) => ({ id: l.id, name: l.name }))}
          boardMembers={members}
          currentUserId={user?.id}
          readOnly={readOnly}
          onClose={() => setOpenCardId(null)}
          onChanged={reloadLists}
        />
      )}

      {shortcutsOpen && (
        <ShortcutsHelp onClose={() => setShortcutsOpen(false)} />
      )}
    </div>
  );
}
