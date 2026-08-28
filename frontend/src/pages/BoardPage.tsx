import {
  useEffect,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import AddListForm from '../components/board/AddListForm';
import ListColumn from '../components/board/ListColumn';
import ConfirmDialog from '../components/ConfirmDialog';
import type { BoardOutletContext } from '../layouts/BoardViewLayout';
import { updateBoard } from '../lib/api/board';
import {
  createList,
  deleteList,
  fetchBoardLists,
  updateList,
} from '../lib/api/list';
import { assetUrl } from '../lib/assets';
import { getErrorMessage } from '../lib/errorMessage';
import type { BoardList } from '../types/list';

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const { boards, isLoading, error, patchBoard } =
    useOutletContext<BoardOutletContext>();
  const board = boards.find((b) => b.id === boardId);

  // ----- Ten bang -----
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  // ----- Danh sach trong bang -----
  const [lists, setLists] = useState<BoardList[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [listsError, setListsError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BoardList | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function handleAddList(name: string) {
    if (!boardId) return;
    const created = await createList(boardId, name);
    setLists((cur) => [...cur, created]);
  }

  async function handleRenameList(listId: string, name: string) {
    setLists((cur) =>
      cur.map((l) => (l.id === listId ? { ...l, name } : l))
    );
    try {
      await updateList(listId, { name });
    } catch (err) {
      setListsError(getErrorMessage(err, 'Không đổi được tên danh sách.'));
      if (boardId) fetchBoardLists(boardId).then(setLists);
    }
  }

  async function confirmDeleteList() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteList(deleteTarget.id);
      setLists((cur) => cur.filter((l) => l.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      setListsError(getErrorMessage(err, 'Không xoá được danh sách.'));
    } finally {
      setDeleting(false);
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
      <div className="flex shrink-0 items-center gap-3 bg-black/25 px-4 py-2 backdrop-blur-sm">
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
            className="rounded px-2 py-1 text-lg font-bold text-white hover:bg-white/20"
          >
            {board.name}
          </button>
        )}
      </div>

      {(saveError || listsError) && (
        <p className="mx-4 mt-2 w-fit rounded bg-red-600/90 px-3 py-1 text-sm text-white">
          {saveError ?? listsError}
        </p>
      )}

      {/* Hang cac danh sach */}
      <div className="flex flex-1 items-start gap-3 overflow-x-auto p-3">
        {listsLoading ? (
          <p className="rounded bg-white/80 px-3 py-2 text-sm text-slate-600">
            Đang tải danh sách...
          </p>
        ) : (
          <>
            {lists.map((list) => (
              <ListColumn
                key={list.id}
                list={list}
                onRename={handleRenameList}
                onRequestDelete={setDeleteTarget}
              />
            ))}
            <AddListForm onAdd={handleAddList} />
          </>
        )}
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Xoá danh sách?"
        message={
          deleteTarget
            ? `Danh sách "${deleteTarget.name}" sẽ bị xoá.`
            : undefined
        }
        confirmLabel="Xoá danh sách"
        danger
        busy={deleting}
        onConfirm={confirmDeleteList}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </div>
  );
}
