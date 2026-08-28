import { useState, type FormEvent, type KeyboardEvent } from 'react';
import BoardCard from '../components/BoardCard';
import ConfirmDialog from '../components/ConfirmDialog';
import { useBoards } from '../context/BoardsContext';
import { createBoard, deleteBoard } from '../lib/api/board';
import { BOARD_COLORS } from '../lib/boardColors';
import { getErrorMessage } from '../lib/errorMessage';
import type { Board } from '../types/board';

interface CreateBoardTileProps {
  onCreated: (board: Board) => void;
}

function CreateBoardTile({ onCreated }: CreateBoardTileProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(BOARD_COLORS[0]!);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function close() {
    setIsOpen(false);
    setName('');
    setColor(BOARD_COLORS[0]!);
    setError(null);
  }

  async function submit() {
    if (!name.trim()) return;
    setIsSubmitting(true);
    setError(null);
    try {
      onCreated(await createBoard({ name: name.trim(), color }));
      close();
    } catch (err) {
      setError(getErrorMessage(err, 'Không tạo được bảng.'));
      setIsSubmitting(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') close();
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex h-28 flex-col items-center justify-center gap-1 rounded-xl bg-slate-200/70 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-200"
      >
        <span className="text-xl leading-none">+</span>
        Tạo bảng mới
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="col-span-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
    >
      {/* Xem truoc */}
      <div
        className="mb-2 flex h-16 items-end rounded-lg p-2"
        style={{ backgroundColor: color }}
      >
        <span className="rounded bg-black/25 px-1.5 py-0.5 text-xs font-semibold text-white">
          {name.trim() || 'Bảng mới'}
        </span>
      </div>

      <input
        autoFocus
        type="text"
        value={name}
        disabled={isSubmitting}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Nhập tên bảng..."
        className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:border-[#0c66e4] focus:outline-none focus:ring-1 focus:ring-[#0c66e4]"
      />

      <div className="mt-2 grid grid-cols-8 gap-1.5">
        {BOARD_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Màu ${c}`}
            className={`h-7 rounded-md ${
              color === c ? 'ring-2 ring-slate-800 ring-offset-1' : ''
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 flex gap-2 text-sm">
        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="rounded-lg bg-[#0c66e4] px-3 py-1.5 font-medium text-white hover:bg-[#0a5cd4] disabled:opacity-50"
        >
          {isSubmitting ? 'Đang tạo...' : 'Tạo bảng'}
        </button>
        <button
          type="button"
          onClick={close}
          className="rounded-lg px-2 py-1.5 text-slate-500 hover:bg-slate-100"
        >
          Huỷ
        </button>
      </div>
    </form>
  );
}

export default function HomePage() {
  const { boards, isLoading, error, upsertBoard, removeBoard } = useBoards();

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
    <div className="flex flex-col gap-4">
      <h1 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Các bảng của bạn
      </h1>

      {(error || actionError) && (
        <p className="text-sm text-red-600">{error ?? actionError}</p>
      )}

      {isLoading ? (
        <p className="text-sm text-slate-500">Đang tải...</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {boards.map((board) => (
            <BoardCard
              key={board.id}
              board={board}
              onChanged={upsertBoard}
              onRequestDelete={setDeleteTarget}
            />
          ))}

          <CreateBoardTile onCreated={upsertBoard} />
        </div>
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
