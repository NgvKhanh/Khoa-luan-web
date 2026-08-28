import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { initialsOf } from '../lib/avatar';

const ICON_BTN =
  'grid h-8 w-8 place-items-center rounded text-slate-600 hover:bg-slate-100';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-slate-200 bg-white px-2 sm:gap-3">
      {/* Nut luoi ung dung */}
      <button type="button" className={ICON_BTN} aria-label="Ứng dụng">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          {[4, 10, 16].map((y) =>
            [4, 10, 16].map((x) => (
              <rect key={`${x}-${y}`} x={x} y={y} width="4" height="4" rx="1" />
            ))
          )}
        </svg>
      </button>

      {/* Logo */}
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
        <span className="text-lg font-bold tracking-tight text-[#0c66e4]">
          TaskFlow
        </span>
      </Link>

      {/* O tim kiem */}
      <div className="relative mx-1 min-w-0 flex-1">
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
          placeholder="Tìm kiếm"
          className="h-8 w-full rounded border border-slate-300 bg-white pl-8 pr-3 text-sm placeholder:text-slate-400 focus:border-[#0c66e4] focus:outline-none focus:ring-1 focus:ring-[#0c66e4]"
        />
      </div>

      {/* Nut Tao moi */}
      <button
        type="button"
        className="hidden shrink-0 rounded bg-[#0c66e4] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0a5cd4] sm:block"
      >
        Tạo mới
      </button>

      {/* Cum bieu tuong ben phai */}
      <button type="button" className={`${ICON_BTN} hidden sm:grid`} aria-label="Thông báo">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10 21a2 2 0 004 0" />
        </svg>
      </button>
      <button type="button" className={`${ICON_BTN} hidden sm:grid`} aria-label="Trợ giúp">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 015 0c0 1.7-2.5 2-2.5 4" />
          <circle cx="12" cy="17" r="0.6" fill="currentColor" />
        </svg>
      </button>

      {/* Avatar + dang xuat */}
      <button
        type="button"
        onClick={handleLogout}
        title={`${user?.name ?? ''} — Đăng xuất`}
        className="ml-1 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#7f5ad5] text-xs font-semibold text-white hover:opacity-90"
      >
        {user ? initialsOf(user.name) : '?'}
      </button>
    </header>
  );
}
