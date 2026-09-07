import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBoards } from '../context/BoardsContext';
import { useTheme } from '../context/ThemeContext';
import { assetUrl } from '../lib/assets';
import type { Board } from '../types/board';
import Avatar from './Avatar';
import CreateBoardDialog from './board/CreateBoardDialog';
import NotificationBell from './NotificationBell';

function Thumb({ board }: { board: Board }) {
  const style = board.backgroundImage
    ? {
        backgroundImage: `url(${assetUrl(board.backgroundImage)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { backgroundColor: board.color };
  return <span className="h-8 w-11 shrink-0 rounded-md" style={style} />;
}

// ------- Tim kiem bang (dropdown kieu Trello) -------
function BoardSearch() {
  const { boards } = useBoards();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
    // Phím "/" -> nhảy vào ô tìm kiếm (khi không gõ ở chỗ khác)
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      if (
        el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.isContentEditable)
      )
        return;
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  function go(id: string) {
    navigate(`/boards/${id}`);
    setQ('');
    setOpen(false);
    inputRef.current?.blur();
  }

  function seeAll() {
    navigate('/');
    setOpen(false);
  }

  return (
    <div ref={boxRef} className="relative min-w-0 flex-1 sm:max-w-md">
      <svg
        viewBox="0 0 24 24"
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        value={q}
        placeholder="Tìm kiếm bảng..."
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setOpen(false);
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === 'Enter' && matches[0]) go(matches[0].id);
        }}
        className="h-9 w-full rounded-lg border border-transparent bg-slate-100 pl-9 pr-9 text-sm text-slate-800 placeholder:text-slate-400 transition focus:border-[#0c66e4] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0c66e4]/25 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:bg-slate-800"
      />
      {q ? (
        <button
          type="button"
          onClick={() => {
            setQ('');
            inputRef.current?.focus();
          }}
          aria-label="Xoá"
          className="absolute right-2 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-slate-300 bg-white px-1.5 text-[11px] font-medium text-slate-400 sm:block dark:border-slate-600 dark:bg-slate-900">
          /
        </kbd>
      )}

      {open && term && (
        <div className="absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          <div className="border-b border-slate-200 px-3 dark:border-slate-700">
            <span className="inline-block border-b-2 border-[#0c66e4] py-2 text-sm font-medium text-[#0c66e4]">
              Bảng
            </span>
          </div>

          <div className="py-2">
            <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
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
                    className="flex w-full items-center gap-3 px-3 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <Thumb board={b} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm text-[#172b4d] dark:text-slate-100">
                        {b.name}
                      </span>
                      <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
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

          <button
            type="button"
            disabled={!matches[0]}
            onClick={() => matches[0] && go(matches[0].id)}
            className="flex w-full items-center gap-2 border-t border-slate-200 px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
            <span className="flex-1 truncate">
              {matches[0] ? `Mở "${matches[0].name}"` : 'Tìm kiếm'}
            </span>
            <kbd className="rounded border border-slate-300 bg-slate-50 px-1.5 text-xs text-slate-500 dark:border-slate-600 dark:bg-slate-900">
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
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg bg-[#0c66e4] px-2.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0a5cd4] hover:shadow sm:px-3"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span className="hidden sm:inline">Tạo mới</span>
      </button>

      {open && (
        <CreateBoardDialog
          className="absolute right-0 top-11 z-40"
          onClose={() => setOpen(false)}
          onCreated={(board) => {
            upsertBoard(board);
            setOpen(false);
            navigate(`/boards/${board.id}`);
          }}
        />
      )}
    </div>
  );
}

// ------- Menu tai khoan -------
const THEME_LABEL = { light: 'Sáng', dark: 'Tối', system: 'Hệ thống' } as const;

function AccountMenu() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setThemeOpen(false);
      }
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  function go(path: string) {
    setOpen(false);
    navigate(path);
  }

  const item =
    'w-full rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700';

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={user?.name}
        className="grid shrink-0 place-items-center rounded-full ring-2 ring-transparent transition hover:ring-slate-200 dark:hover:ring-slate-700"
      >
        <Avatar
          id={user?.id ?? 'me'}
          name={user?.name ?? '?'}
          avatarUrl={user?.avatarUrl}
          className="h-8 w-8 text-xs"
        />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-800 shadow-2xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/40">
            <Avatar
              id={user?.id ?? 'me'}
              name={user?.name ?? '?'}
              avatarUrl={user?.avatarUrl}
              className="h-10 w-10 text-base"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user?.name}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {user?.email}
              </p>
            </div>
          </div>

          <div className="p-1.5">
            <button type="button" className={item} onClick={() => go('/settings/profile')}>
              Hồ sơ
            </button>
            <button type="button" className={item} onClick={() => go('/my-cards')}>
              Thẻ của tôi
            </button>
            <button type="button" className={item} onClick={() => go('/calendar')}>
              Lịch
            </button>
            <button type="button" className={item} onClick={() => go('/settings/password')}>
              Đổi mật khẩu
            </button>
            <button type="button" className={item} onClick={() => go('/activity')}>
              Hoạt động của tôi
            </button>

            <button
              type="button"
              className={item + ' flex items-center justify-between'}
              onClick={() => setThemeOpen((v) => !v)}
            >
              <span>Chủ đề</span>
              <span className="flex items-center gap-1 text-xs text-slate-400">
                {THEME_LABEL[theme]}
                <svg viewBox="0 0 24 24" className={`h-3.5 w-3.5 transition-transform ${themeOpen ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </span>
            </button>
            {themeOpen && (
              <div className="mb-1 ml-2 border-l border-slate-200 pl-1.5 dark:border-slate-700">
                {(['light', 'dark', 'system'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    {THEME_LABEL[t]}
                    {theme === t && (
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#0c66e4]" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}

            <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
            <button
              type="button"
              onClick={handleLogout}
              className={item + ' font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10'}
            >
              Đăng xuất
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Header() {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-3 sm:gap-4 sm:px-4 dark:border-slate-700 dark:bg-slate-900">
      <Link
        to="/"
        className="flex shrink-0 items-center gap-2 rounded-lg px-1.5 py-1 transition hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-[#0c66e4] to-[#0a4db3] shadow-sm">
          <span className="flex items-end gap-[2px]">
            <span className="h-3.5 w-[3px] rounded-[1px] bg-white" />
            <span className="h-2 w-[3px] rounded-[1px] bg-white/90" />
            <span className="h-2.5 w-[3px] rounded-[1px] bg-white/80" />
          </span>
        </span>
        <span className="hidden text-lg font-extrabold tracking-tight text-slate-800 sm:block dark:text-white">
          TaskFlow
        </span>
      </Link>

      <BoardSearch />

      <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
        <CreateBoardMenu />
        <NotificationBell />
        <AccountMenu />
      </div>
    </header>
  );
}
