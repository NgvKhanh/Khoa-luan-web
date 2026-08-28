import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  clearBoardBackground,
  updateBoard,
  uploadBoardBackground,
} from '../lib/api/board';
import { assetUrl } from '../lib/assets';
import { BOARD_COLORS } from '../lib/boardColors';
import { getErrorMessage } from '../lib/errorMessage';
import type { Board } from '../types/board';

interface Props {
  board: Board;
  onChanged: (board: Board) => void;
  onRequestDelete: (board: Board) => void;
}

export default function BoardCard({ board, onChanged, onRequestDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  const hasImage = Boolean(board.backgroundImage);
  const bgStyle = hasImage
    ? {
        backgroundImage: `url(${assetUrl(board.backgroundImage)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { backgroundColor: board.color };

  async function run(action: () => Promise<Board>) {
    setBusy(true);
    setError(null);
    try {
      onChanged(await action());
      setMenuOpen(false);
    } catch (err) {
      setError(getErrorMessage(err, 'Thao tác thất bại.'));
    } finally {
      setBusy(false);
    }
  }

  function pickColor(color: string) {
    void run(() => updateBoard(board.id, { color }));
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // cho phep chon lai cung file
    if (file) void run(() => uploadBoardBackground(board.id, file));
  }

  return (
    <div
      className={`group relative h-28 rounded-xl shadow-sm ring-1 ring-black/5 transition-transform hover:-translate-y-0.5 hover:shadow-md ${
        menuOpen ? 'z-40' : ''
      }`}
    >
      {/* Lop hinh anh - bam vao de mo bang; bo cat rieng de menu ben ngoai khong bi che */}
      <Link
        to={`/boards/${board.id}`}
        title={board.name}
        style={bgStyle}
        className="absolute inset-0 overflow-hidden rounded-xl"
      >
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
        <p className="absolute inset-x-0 bottom-0 line-clamp-2 px-3 pb-2.5 text-sm font-semibold leading-snug text-white drop-shadow">
          {board.name}
        </p>
      </Link>

      {/* Nut ... */}
      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label="Tuỳ chọn bảng"
        aria-expanded={menuOpen}
        className="absolute right-1.5 top-1.5 z-10 grid h-7 w-7 place-items-center rounded-lg bg-black/30 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/50 group-hover:opacity-100 aria-expanded:opacity-100"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Đóng menu"
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div className="absolute right-0 top-[calc(100%+4px)] z-40 w-56 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-xl">
            <p className="mb-1.5 text-xs font-semibold text-slate-500">Ảnh nền</p>

            <div className="grid grid-cols-4 gap-1.5">
              {BOARD_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={busy}
                  onClick={() => pickColor(c)}
                  aria-label={`Màu ${c}`}
                  className={`h-7 rounded-md disabled:opacity-50 ${
                    !hasImage && board.color === c
                      ? 'ring-2 ring-slate-800 ring-offset-1'
                      : ''
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>

            <button
              type="button"
              disabled={busy}
              onClick={() => fileRef.current?.click()}
              className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-300 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
              </svg>
              {busy ? 'Đang tải...' : 'Tải ảnh lên'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={onFileChange}
            />

            {hasImage && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void run(() => clearBoardBackground(board.id))}
                className="mt-1 w-full rounded-md py-1.5 text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                Bỏ ảnh nền
              </button>
            )}

            {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

            <div className="my-2 border-t border-slate-200" />

            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onRequestDelete(board);
              }}
              className="w-full rounded-md py-1.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
            >
              Xoá bảng
            </button>
          </div>
        </>
      )}
    </div>
  );
}
