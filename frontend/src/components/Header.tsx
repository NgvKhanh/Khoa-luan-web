import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
      <span className="text-sm font-medium text-slate-500 sm:hidden">
        TaskFlow
      </span>
      <span className="hidden text-sm text-slate-500 sm:block" />
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-700">{user?.name}</span>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Đăng xuất
        </button>
      </div>
    </header>
  );
}
