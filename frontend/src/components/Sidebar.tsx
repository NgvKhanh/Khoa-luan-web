import { NavLink } from 'react-router-dom';
import { useBoards } from '../context/BoardsContext';
import { useWorkspaces } from '../context/WorkspacesContext';
import { assetUrl } from '../lib/assets';

const ACTIVE =
  'flex items-center gap-3 rounded px-3 py-2 text-sm bg-[#e9f2ff] font-semibold text-[#0c66e4] dark:bg-[#0c66e4]/20';
const INACTIVE =
  'flex items-center gap-3 rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700';

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

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export default function Sidebar() {
  const { boards } = useBoards();
  const { workspaces, currentWorkspaceId, setCurrentWorkspaceId } =
    useWorkspaces();
  const starred = boards.filter((b) => b.isStarred);

  return (
    <aside className="hidden w-64 shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-2 md:block dark:border-slate-700 dark:bg-slate-800">
      <nav className="flex flex-col gap-0.5">
        <NavLink to="/boards" end className={({ isActive }) => (isActive ? ACTIVE : INACTIVE)}>
          <span className="text-slate-500">
            <BoardIcon />
          </span>
          Bảng
        </NavLink>

        <NavLink
          to="/templates"
          className={({ isActive }) => (isActive ? ACTIVE : INACTIVE)}
        >
          <span className="text-slate-500">
            <TemplateIcon />
          </span>
          Mẫu
        </NavLink>

        <NavLink
          to="/home"
          className={({ isActive }) => (isActive ? ACTIVE : INACTIVE)}
        >
          <span className="text-slate-500">
            <ActivityIcon />
          </span>
          Trang chủ
        </NavLink>

        <NavLink
          to="/search"
          className={({ isActive }) => (isActive ? ACTIVE : INACTIVE)}
        >
          <span className="text-slate-500">
            <SearchIcon />
          </span>
          Tìm kiếm nâng cao
        </NavLink>
      </nav>

      <div className="my-2 border-t border-slate-200 dark:border-slate-700" />

      {starred.length > 0 && (
        <div className="mb-2">
          <p className="flex items-center gap-1 px-3 pb-1 text-xs font-semibold text-slate-500">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-amber-400" fill="currentColor">
              <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" />
            </svg>
            Yêu thích
          </p>
          {starred.map((b) => {
            const style = b.backgroundImage
              ? {
                  backgroundImage: `url(${assetUrl(b.backgroundImage)})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }
              : { backgroundColor: b.color };
            return (
              <NavLink
                key={b.id}
                to={`/boards/${b.id}`}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded px-3 py-2 text-sm dark:text-slate-200 ${
                    isActive
                      ? 'bg-[#e9f2ff] font-semibold text-[#0c66e4]'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`
                }
              >
                <span className="h-4 w-5 shrink-0 rounded-[3px]" style={style} />
                <span className="truncate">{b.name}</span>
              </NavLink>
            );
          })}
        </div>
      )}

      <p className="px-3 pb-1 pt-1 text-xs font-semibold text-slate-500">
        Các Không gian làm việc
      </p>

      <div className="flex flex-col gap-2">
        {workspaces.map((w) => {
          const wsBoards = boards.filter((b) => b.workspaceId === w.id);
          const isCurrent = w.id === currentWorkspaceId;
          return (
            <div key={w.id}>
              <button
                type="button"
                onClick={() => setCurrentWorkspaceId(w.id)}
                className={`flex w-full items-center gap-3 rounded px-3 py-2 text-sm ${
                  isCurrent
                    ? 'bg-[#e9f2ff] font-semibold text-[#0c66e4] dark:bg-[#0c66e4]/20'
                    : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded bg-gradient-to-br from-[#8bbdd9] to-[#0c66e4] text-xs font-bold text-white">
                  {w.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="flex-1 truncate text-left font-medium">
                  {w.name}
                </span>
              </button>

              {isCurrent && (
                <div className="ml-3 mt-0.5 flex flex-col gap-0.5 border-l border-slate-200 pl-2 dark:border-slate-700">
                  {wsBoards.map((b) => (
                    <NavLink
                      key={b.id}
                      to={`/boards/${b.id}`}
                      className={({ isActive }) =>
                        `flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
                          isActive
                            ? 'bg-[#e9f2ff] font-semibold text-[#0c66e4] dark:bg-[#0c66e4]/20'
                            : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                        }`
                      }
                    >
                      <span
                        className="h-4 w-5 shrink-0 rounded-[3px]"
                        style={
                          b.backgroundImage
                            ? {
                                backgroundImage: `url(${assetUrl(b.backgroundImage)})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                              }
                            : { backgroundColor: b.color }
                        }
                      />
                      <span className="truncate">{b.name}</span>
                    </NavLink>
                  ))}
                  <NavLink
                    to={`/workspaces/${w.id}`}
                    className="flex items-center gap-2 rounded px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.14.31.22.65.22 1z" />
                    </svg>
                    Quản lý không gian
                  </NavLink>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
