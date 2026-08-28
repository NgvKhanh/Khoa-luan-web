import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createBoard, deleteBoard, fetchMyBoards } from '../lib/api/board';
import { getErrorMessage } from '../lib/errorMessage';
import type { Board } from '../types/board';

// Bang mau chon khi tao bang (kieu Trello)
const BOARD_COLORS = [
  '#0079BF',
  '#D29034',
  '#519839',
  '#B04632',
  '#89609E',
  '#CD5A91',
  '#00AECC',
  '#838C91',
];

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
      const board = await createBoard({ name: name.trim(), color });
      onCreated(board);
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
        className="flex h-24 flex-col items-center justify-center gap-1 rounded-lg bg-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-300"
      >
        <span className="text-lg leading-none">+</span>
        Tạo bảng mới
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="col-span-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:col-span-2"
    >
      <div
        className="mb-2 h-10 rounded"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <input
        autoFocus
        type="text"
        value={name}
        disabled={isSubmitting}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Nhập tên bảng..."
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:border-[#0c66e4] focus:outline-none"
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {BOARD_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`Màu ${c}`}
            className={`h-6 w-8 rounded ${color === c ? 'ring-2 ring-slate-800 ring-offset-1' : ''}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      <div className="mt-3 flex gap-2 text-sm">
        <button
          type="submit"
          disabled={isSubmitting || !name.trim()}
          className="rounded bg-[#0c66e4] px-3 py-1.5 font-medium text-white hover:bg-[#0a5cd4] disabled:opacity-50"
        >
          {isSubmitting ? 'Đang tạo...' : 'Tạo bảng'}
        </button>
        <button
          type="button"
          onClick={close}
          className="px-2 py-1.5 text-slate-500 hover:text-slate-700"
        >
          Huỷ
        </button>
      </div>
    </form>
  );
}

export default function HomePage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyBoards()
      .then(setBoards)
      .catch((err) => setError(getErrorMessage(err, 'Không tải được danh sách bảng.')))
      .finally(() => setIsLoading(false));
  }, []);

  async function handleDelete(board: Board) {
    if (!window.confirm(`Xoá bảng "${board.name}"?`)) return;
    const prev = boards;
    setBoards((list) => list.filter((b) => b.id !== board.id));
    try {
      await deleteBoard(board.id);
    } catch (err) {
      setBoards(prev);
      setError(getErrorMessage(err, 'Không xoá được bảng.'));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Các bảng của bạn
      </h1>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isLoading ? (
        <p className="text-sm text-slate-500">Đang tải...</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {boards.map((board) => (
            <div
              key={board.id}
              title={board.name}
              className="group relative flex h-24 items-start justify-between overflow-hidden rounded-lg p-3 font-semibold text-white shadow-sm"
              style={{ backgroundColor: board.color }}
            >
              <span className="relative z-10 leading-snug line-clamp-3">
                {board.name}
              </span>
              <button
                type="button"
                onClick={() => handleDelete(board)}
                aria-label="Xoá bảng"
                className="relative z-20 rounded p-0.5 text-white/80 opacity-0 transition-opacity hover:bg-black/20 hover:text-white group-hover:opacity-100"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
              <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
            </div>
          ))}

          <CreateBoardTile
            onCreated={(board) => setBoards((list) => [board, ...list])}
          />
        </div>
      )}
    </div>
  );
}
