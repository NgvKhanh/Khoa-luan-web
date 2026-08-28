import { NavLink } from 'react-router-dom';

const ACTIVE = 'flex items-center gap-3 rounded px-3 py-2 text-sm bg-[#e9f2ff] font-semibold text-[#0c66e4]';
const INACTIVE = 'flex items-center gap-3 rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100';

function BoardIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
      <rect x="3" y="4" width="8" height="16" rx="1" />
      <rect x="13" y="4" width="8" height="10" rx="1" />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </svg>
  );
}

function ActivityIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12h4l2 6 4-14 2 8h6" />
    </svg>
  );
}

export default function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-2 md:block">
      <nav className="flex flex-col gap-0.5">
        <NavLink to="/" end className={({ isActive }) => (isActive ? ACTIVE : INACTIVE)}>
          <span className="text-slate-500">
            <BoardIcon />
          </span>
          Bảng
        </NavLink>

        <button type="button" className={INACTIVE}>
          <span className="text-slate-500">
            <TemplateIcon />
          </span>
          Mẫu
        </button>

        <button type="button" className={INACTIVE}>
          <span className="text-slate-500">
            <ActivityIcon />
          </span>
          Trang chủ
        </button>
      </nav>

      <div className="my-2 border-t border-slate-200" />

      <p className="px-3 pb-1 pt-1 text-xs font-semibold text-slate-500">
        Các Không gian làm việc
      </p>

      <button
        type="button"
        className="flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-gradient-to-br from-[#8bbdd9] to-[#0c66e4] text-xs font-bold text-white">
          K
        </span>
        <span className="flex-1 truncate text-left font-medium">
          Không gian làm việc
        </span>
        <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
    </aside>
  );
}
