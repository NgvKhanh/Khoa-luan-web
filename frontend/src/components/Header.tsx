import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBoards } from '../context/BoardsContext';
import { createBoard } from '../lib/api/board';
import { assetUrl } from '../lib/assets';
import { initialsOf } from '../lib/avatar';
import { BOARD_COLORS } from '../lib/boardColors';
import { getErrorMessage } from '../lib/errorMessage';
import type { Board } from '../types/board';

function Thumb({ board }: { board: Board }) {
  const style = board.backgroundImage
    ? {
        backgroundImage: `url(${assetUrl(board.backgroundImage)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { backgroundColor: board.color };
  return <span className="h-8 w-11 shrink-0 rounded" style={style} />;
}

// ------- Tim kiem bang (dropdown kieu Trello) -------
function BoardSearch() {
  const { boards } = useBoards();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const term = q.trim().toLowerCase();
  const allMatches = useMemo(
    () => (term ? boards.filter((b) => b.name.toLowerCase().includes(term)) : []),
    [term, boards]
  );
  const matches = allMatches.slice(0, 5);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  function go(id: string) {
    navigate(`/boards/${id}`);
    setQ('');
    setOpen(false);
  }

  function seeAll() {
    navigate('/');
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative mx-1 min-w-0 flex-1">
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        type="text"
        value={q}
        placeholder="Tìm kiếm"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter' && matches[0]) go(matches[0].id);
        }}
        className="h-8 w-full rounded border border-slate-300 bg-white pl-8 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-[#0c66e4] focus:outline-none focus:ring-1 focus:ring-[#0c66e4]"
      />

      {open && term && (
        <div className="absolute left-0 right-0 top-10 z-40 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl">
          {/* Tab */}
          <div className="border-b border-slate-200 px-3">
            <span className="inline-block border-b-2 border-[#0c66e4] py-2 text-sm font-medium text-[#0c66e4]">
              Bảng
            </span>
          </div>

          <div className="py-2">
            <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-slate-500">
              BẢNG
            </p>

            {matches.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-400">
                Không tìm thấy bảng nào khớp "{q.trim()}".
              </p>
            ) : (
              <>
                {matches.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => go(b.id)}
                    className="flex w-full items-center gap-3 px-3 py-1.5 text-left hover:bg-slate-100"
                  >
                    <Thumb board={b} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-[#172b4d]">
                        {b.name}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        Không gian làm việc
                      </span>
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={seeAll}
                  className="px-3 py-2 text-sm font-medium text-[#0c66e4] hover:underline"
                >
                  Xem tất cả các kết quả
                </button>
              </>
            )}
          </div>

          {/* Dong duoi cung: mo bang dau tien */}
          <button
            type="button"
            disabled={!matches[0]}
            onClick={() => matches[0] && go(matches[0].id)}
            className="flex w-full items-center gap-2 border-t border-slate-200 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <span className="flex-1 truncate">
              {matches[0] ? `Mở "${matches[0].name}"` : 'Tìm kiếm'}
            </span>
            <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 text-xs text-slate-500">
              ⏎
            </kbd>
          </button>
        </div>
      )}
    </div>
  );
}

// ------- Tao bang moi -------
function CreateBoardMenu() {
  const navigate = useNavigate();
  const { upsertBoard } = useBoards();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [color, setColor] = useState(BOARD_COLORS[0]!);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const board = await createBoard({ name: name.trim(), color });
      upsertBoard(board);
      setOpen(false);
      setName('');
      navigate(`/boards/${board.id}`);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tạo được bảng.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded bg-[#0c66e4] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0a5cd4]"
      >
        Tạo mới
      </button>

      {open && (
        <form
          onSubmit={submit}
          className="absolute right-0 top-10 z-40 w-72 rounded-xl border border-slate-200 bg-white p-3 text-slate-800 shadow-2xl"
        >
          <p className="mb-2 text-sm font-semibold">Bảng mới</p>
          <div
            className="mb-2 flex h-12 items-end rounded-lg p-2"
            style={{ backgroundColor: color }}
          >
            <span className="rounded bg-black/25 px-1.5 py-0.5 text-xs font-semibold text-white">
              {name.trim() || 'Bảng mới'}
            </span>
          </div>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            placeholder="Nhập tên bảng..."
            className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm focus:border-[#0c66e4] focus:outline-none"
          />
          <div className="mt-2 grid grid-cols-8 gap-1.5">
            {BOARD_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Màu ${c}`}
                className={`h-6 rounded ${
                  color === c ? 'ring-2 ring-slate-800 ring-offset-1' : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="mt-3 w-full rounded-lg bg-[#0c66e4] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0a5cd4] disabled:opacity-50"
          >
            {busy ? 'Đang tạo...' : 'Tạo bảng'}
          </button>
        </form>
      )}
    </div>
  );
}

// ------- Menu tai khoan -------
function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={user?.name}
        className="grid h-8 w-8 place-items-center rounded-full bg-[#7f5ad5] text-xs font-semibold text-white hover:opacity-90"
      >
        {user ? initialsOf(user.name) : '?'}
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-40 w-60 rounded-xl border border-slate-200 bg-white p-2 text-slate-800 shadow-2xl">
          <div className="flex items-center gap-2 px-2 py-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#7f5ad5] text-sm font-semibold text-white">
              {user ? initialsOf(user.name) : '?'}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.name}</p>
              <p className="truncate text-xs text-slate-500">{user?.email}</p>
            </div>
          </div>
          <div className="my-1 border-t border-slate-200" />
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-lg px-2 py-1.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Đăng xuất
          </button>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 sm:gap-3">
      <Link
        to="/"
        className="flex shrink-0 items-center gap-1.5 rounded px-1.5 py-1 hover:bg-slate-100"
      >
        <span className="grid h-6 w-6 place-items-center rounded-[5px] bg-[#0c66e4]">
          <span className="flex gap-[2px]">
            <span className="h-3 w-[3px] rounded-[1px] bg-white" />
            <span className="h-2 w-[3px] rounded-[1px] bg-white" />
          </span>
        </span>
        <span className="hidden text-lg font-bold tracking-tight text-[#0c66e4] sm:block">
          TaskFlow
        </span>
      </Link>

      <BoardSearch />
      <CreateBoardMenu />
      <AccountMenu />
    </header>
  );
}
