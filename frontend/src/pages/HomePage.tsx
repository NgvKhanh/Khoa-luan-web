import { useEffect, useRef, useState } from 'react';
import BoardCard from '../components/BoardCard';
import CreateBoardDialog from '../components/board/CreateBoardDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { useBoards } from '../context/BoardsContext';
import { deleteBoard } from '../lib/api/board';
import { getErrorMessage } from '../lib/errorMessage';
import type { Board } from '../types/board';

function CreateBoardTile({ onCreated }: { onCreated: (board: Board) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-28 w-full flex-col items-center justify-center gap-1 rounded-xl bg-slate-200/70 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200"
      >
        <span className="text-xl leading-none">+</span>
        Tạo bảng mới
      </button>

      {open && (
        <CreateBoardDialog
          className="absolute left-0 top-[calc(100%+6px)] z-40"
          onClose={() => setOpen(false)}
          onCreated={(board) => {
            onCreated(board);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default function HomePage() {
  const { boards, isLoading, error, upsertBoard, removeBoard, toggleStar } =
    useBoards();

  const starred = boards.filter((b) => b.isStarred);

  const [deleteTarget, setDeleteTarget] = useState<Board | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteBoard(deleteTarget.id);
      removeBoard(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setActionError(getErrorMessage(err, 'Không xoá được bảng.'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {(error || actionError) && (
        <p className="text-sm text-red-600">{error ?? actionError}</p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Đang tải...</p>
      ) : (
        <>
          {starred.length > 0 && (
            <div className="flex flex-col gap-3">
              <h1 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-500">
                <svg viewBox="0 0 24 24" className="h-4 w-4 text-amber-400" fill="currentColor">
                  <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" />
                </svg>
                Được đánh dấu sao
              </h1>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {starred.map((board) => (
                  <BoardCard
                    key={board.id}
                    board={board}
                    onChanged={upsertBoard}
                    onRequestDelete={setDeleteTarget}
                    onToggleStar={toggleStar}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <h1 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              Các bảng của bạn
            </h1>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {boards.map((board) => (
                <BoardCard
                  key={board.id}
                  board={board}
                  onChanged={upsertBoard}
                  onRequestDelete={setDeleteTarget}
                  onToggleStar={toggleStar}
                />
              ))}

              <CreateBoardTile onCreated={upsertBoard} />
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Xoá bảng?"
        message={
          deleteTarget
            ? `Bảng "${deleteTarget.name}" sẽ bị xoá. Bạn có thể tạo lại sau.`
            : undefined
        }
        confirmLabel="Xoá bảng"
        danger
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setDeleteTarget(null)}
      />
    </div>
  );
}
