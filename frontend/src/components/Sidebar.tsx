import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Trang chủ' },
  { to: '/my-tasks', label: 'Công việc của tôi' },
  { to: '/teams', label: 'Nhóm' },
  { to: '/projects', label: 'Dự án' },
];

export default function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white p-4 sm:block">
      <div className="mb-6 px-2 text-lg font-bold text-slate-800">TaskFlow</div>
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-100'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
