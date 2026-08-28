import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
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
import BoardBackgroundMenu from '../components/board/BoardBackgroundMenu';
import BoardMembers from '../components/board/BoardMembers';
import CardItem from '../components/board/CardItem';
import ListColumn from '../components/board/ListColumn';
import ListColumnOverlay from '../components/board/ListColumnOverlay';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import type { BoardOutletContext } from '../layouts/BoardViewLayout';
import {
  addBoardMember,
  fetchBoardMembers,
  removeBoardMember,
  updateBoard,
} from '../lib/api/board';
import { createCard, deleteCard, moveCard, updateCard } from '../lib/api/card';
import {
  copyList,
  createList,
  deleteAllCards,
  deleteList,
  fetchBoardLists,
  moveAllCards,
  reorderList,
  sortListCards,
  updateList,
  type SortListBy,
} from '../lib/api/list';
import { assetUrl } from '../lib/assets';
import { getErrorMessage } from '../lib/errorMessage';
import type { BoardMember } from '../types/board';
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
  | { kind: 'card'; card: Card }
  | { kind: 'cards-in-list'; list: BoardList }
  | null;

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const { user } = useAuth();
  const { boards, isLoading, error, patchBoard } =
    useOutletContext<BoardOutletContext>();
  const board = boards.find((b) => b.id === boardId);
  const isOwner = Boolean(board && user && board.ownerId === user.id);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  const [members, setMembers] = useState<BoardMember[]>([]);

  const [lists, setLists] = useState<BoardList[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [listsError, setListsError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [deleting, setDeleting] = useState(false);
  const [bgMenuOpen, setBgMenuOpen] = useState(false);

  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [activeList, setActiveList] = useState<BoardList | null>(null);

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

  async function handleAddMember(email: string) {
    if (!boardId) return;
    const created = await addBoardMember(boardId, email);
    setMembers((cur) =>
      cur.some((m) => m.userId === created.userId) ? cur : [...cur, created]
    );
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

  const listDndIds = useMemo(() => lists.map((l) => `list-${l.id}`), [lists]);

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

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.kind === 'list') {
        await deleteList(deleteTarget.list.id);
        setLists((cur) => cur.filter((l) => l.id !== deleteTarget.list.id));
      } else if (deleteTarget.kind === 'cards-in-list') {
        await deleteAllCards(deleteTarget.list.id);
        setLists((cur) =>
          cur.map((l) =>
            l.id === deleteTarget.list.id ? { ...l, cards: [] } : l
          )
        );
      } else {
        await deleteCard(deleteTarget.card.id);
        setLists((cur) =>
          cur.map((l) => ({
            ...l,
            cards: l.cards.filter((c) => c.id !== deleteTarget.card.id),
          }))
        );
      }
      setDeleteTarget(null);
    } catch (err) {
      setListsError(getErrorMessage(err, 'Xoá không thành công.'));
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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const type = active.data.current?.type;
    setActiveCard(null);
    setActiveList(null);
    endDragCursor();
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
        <p className="text-sm text-slate-600">Không tìm thấy bảng này.</p>
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
        {editing ? (
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
            onClick={() => {
              setDraft(board.name);
              setEditing(true);
            }}
            className="rounded px-2 py-1 text-lg font-bold text-white drop-shadow-sm hover:bg-white/20"
          >
            {board.name}
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <button
              type="button"
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
              <>
                <button
                  type="button"
                  aria-label="Đóng"
                  onClick={() => setBgMenuOpen(false)}
                  className="fixed inset-0 z-30 cursor-default"
                />
                <BoardBackgroundMenu
                  className="absolute right-0 top-11 z-40"
                  board={board}
                  onChanged={patchBoard}
                  onClose={() => setBgMenuOpen(false)}
                />
              </>
            )}
          </div>

          <BoardMembers
            members={members}
            currentUserId={user?.id}
            isOwner={isOwner}
            onAdd={handleAddMember}
            onRemove={handleRemoveMember}
          />
        </div>
      </div>

      {(saveError || listsError) && (
        <p className="mx-4 mt-2 w-fit rounded bg-red-600/90 px-3 py-1 text-sm text-white">
          {saveError ?? listsError}
        </p>
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
          }}
        >
          <div
            className={`flex flex-1 items-start gap-3 overflow-x-auto p-3 ${
              activeCard || activeList ? 'select-none' : ''
            }`}
          >
            <SortableContext
              items={listDndIds}
              strategy={horizontalListSortingStrategy}
            >
              {lists.map((list) => (
                <ListColumn
                  key={list.id}
                  list={list}
                  allLists={lists}
                  onRename={handleRenameList}
                  onRequestDeleteList={(l) =>
                    setDeleteTarget({ kind: 'list', list: l })
                  }
                  onAddCard={handleAddCard}
                  onToggleCardDone={handleToggleCardDone}
                  onRequestDeleteCard={(c) =>
                    setDeleteTarget({ kind: 'card', card: c })
                  }
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

            <AddListForm onAdd={handleAddList} />
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
          deleteTarget?.kind === 'card'
            ? 'Xoá thẻ?'
            : deleteTarget?.kind === 'cards-in-list'
              ? 'Xoá tất cả thẻ?'
              : 'Xoá danh sách?'
        }
        message={
          deleteTarget?.kind === 'card'
            ? `Thẻ "${deleteTarget.card.title}" sẽ bị xoá.`
            : deleteTarget?.kind === 'cards-in-list'
              ? `Toàn bộ ${deleteTarget.list.cards.length} thẻ trong danh sách "${deleteTarget.list.name}" sẽ bị xoá.`
              : deleteTarget?.kind === 'list'
                ? `Danh sách "${deleteTarget.list.name}" (và các thẻ bên trong) sẽ bị xoá.`
                : undefined
        }
        confirmLabel={
          deleteTarget?.kind === 'card'
            ? 'Xoá thẻ'
            : deleteTarget?.kind === 'cards-in-list'
              ? 'Xoá tất cả thẻ'
              : 'Xoá danh sách'
        }
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </div>
  );
}
