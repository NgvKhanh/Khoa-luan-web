import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { fetchMyTeams } from '../lib/api/team';
import { colorForId, initialsOf } from '../lib/avatar';
import type { TeamListItem } from '../types/team';

const navItems = [
  { to: '/', label: 'Bảng', end: true },
  { to: '/my-tasks', label: 'Công việc của tôi', end: false },
];

function linkClass({ isActive }: { isActive: boolean }): string {
  return `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
    isActive ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
  }`;
}

export default function Sidebar() {
  const [teams, setTeams] = useState<TeamListItem[]>([]);

  useEffect(() => {
    fetchMyTeams()
      .then(setTeams)
      .catch(() => setTeams([]));
  }, []);

  return (
    <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white p-3 lg:block">
      <nav className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="my-3 border-t border-slate-200" />

      <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Các không gian làm việc
      </p>
      <nav className="flex flex-col gap-1">
        {teams.map((team) => (
          <NavLink
            key={team.id}
            to={`/teams/${team.id}`}
            className={linkClass}
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white"
              style={{ backgroundColor: colorForId(team.id) }}
            >
              {initialsOf(team.name)}
            </span>
            <span className="truncate">{team.name}</span>
          </NavLink>
        ))}
        {teams.length === 0 && (
          <p className="px-3 text-xs text-slate-400">Chưa có nhóm nào.</p>
        )}
      </nav>
    </aside>
  );
}
