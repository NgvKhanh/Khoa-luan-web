import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { initialsOf } from '../lib/avatar';

const navLinks = [
  { to: '/', label: 'Trang chủ', end: true },
  { to: '/my-tasks', label: 'Công việc của tôi', end: false },
  { to: '/teams', label: 'Nhóm', end: false },
  { to: '/projects', label: 'Dự án', end: false },
];

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header
      className="flex h-12 shrink-0 items-center gap-2 px-3 text-white sm:gap-4 sm:px-4"
      style={{ backgroundColor: 'var(--nav-bg)' }}
    >
      <Link
        to="/"
        className="flex shrink-0 items-center gap-2 rounded px-2 py-1 font-bold tracking-tight hover:bg-white/15"
      >
        <span className="grid h-5 w-5 place-items-center rounded bg-white text-[color:var(--nav-bg)]">
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
            <rect x="3" y="3" width="7" height="18" rx="1" />
            <rect x="14" y="3" width="7" height="11" rx="1" />
          </svg>
        </span>
        TaskFlow
      </Link>

      <nav className="board-scroll flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {navLinks.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `shrink-0 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-white/25' : 'hover:bg-white/15'
              }`
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-2">
        <span
          title={user?.name}
          className="grid h-7 w-7 place-items-center rounded-full bg-white/25 text-xs font-semibold"
        >
          {user ? initialsOf(user.name) : '?'}
        </span>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded px-2 py-1 text-sm font-medium hover:bg-white/15"
        >
          Đăng xuất
        </button>
      </div>
    </header>
  );
}
