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
import { initialsOf } from '../lib/avatar';
import { BOARD_COLORS } from '../lib/boardColors';
import { getErrorMessage } from '../lib/errorMessage';

// ------- Tim kiem bang -------
function BoardSearch() {
  const { boards } = useBoards();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return boards.filter((b) => b.name.toLowerCase().includes(term)).slice(0, 8);
  }, [q, boards]);

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
        placeholder="Tìm bảng..."
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

      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-10 z-40 rounded-lg border border-slate-200 bg-white p-1 text-slate-800 shadow-xl">
          {matches.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400">Không tìm thấy bảng nào.</p>
          ) : (
            matches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => go(b.id)}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100"
              >
                <span
                  className="h-4 w-5 shrink-0 rounded-[3px]"
                  style={{ backgroundColor: b.color }}
                />
                <span className="truncate">{b.name}</span>
              </button>
            ))
          )}
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
