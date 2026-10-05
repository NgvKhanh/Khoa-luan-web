import { Link, NavLink } from 'react-router-dom';
import { useBoards } from '../context/BoardsContext';
import { assetUrl } from '../lib/assets';
import type { Board } from '../types/board';
import NavDrawer from './nav/NavDrawer';

function Swatch({ board }: { board: Board }) {
  const style = board.backgroundImage
    ? {
        backgroundImage: `url(${assetUrl(board.backgroundImage)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { backgroundColor: board.color };
  return <span className="h-4 w-5 shrink-0 rounded-[3px]" style={style} />;
}

function BoardLink({ board }: { board: Board }) {
  return (
    <NavLink
      to={`/boards/${board.id}`}
      className={({ isActive }) =>
        `flex items-center gap-2 rounded px-3 py-2 text-sm ${
          isActive
            ? 'bg-primary-soft font-semibold text-primary-ink'
            : 'text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700'
        }`
      }
    >
      <Swatch board={board} />
      <span className="min-w-0 flex-1 truncate">{board.name}</span>
      {board.isStarred && (
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-amber-400" fill="currentColor">
          <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" />
        </svg>
      )}
    </NavLink>
  );
}

// Nội dung sidebar khi đang xem 1 bảng: dùng chung cho sidebar desktop và ngăn điều hướng điện thoại
function BoardSidebarContent() {
  const { boards } = useBoards();
  const starred = boards.filter((b) => b.isStarred);

  return (
    <>
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-3 dark:border-slate-700">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-gradient-to-br from-[var(--brand-accent)] to-primary text-xs font-bold text-white">
          K
        </span>
        <span className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">
          Không gian làm việc
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <Link
          to="/boards"
          className="flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Tất cả các bảng
        </Link>

        <div className="my-2 border-t border-slate-200 dark:border-slate-700" />

        {starred.length > 0 && (
          <>
            <p className="flex items-center gap-1 px-3 pb-1 text-xs font-semibold text-slate-500">
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 text-amber-400" fill="currentColor">
                <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" />
              </svg>
              Yêu thích
            </p>
            <nav className="mb-2 flex flex-col gap-0.5">
              {starred.map((board) => (
                <BoardLink key={board.id} board={board} />
              ))}
            </nav>
          </>
        )}

        <p className="px-3 pb-1 text-xs font-semibold text-slate-500">
          Các bảng của bạn
        </p>
        <nav className="flex flex-col gap-0.5">
          {boards.map((board) => (
            <BoardLink key={board.id} board={board} />
          ))}
          {boards.length === 0 && (
            <p className="px-3 py-1 text-xs text-slate-400">Chưa có bảng nào.</p>
          )}
        </nav>
      </div>
    </>
  );
}

export default function BoardSidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex dark:border-slate-700 dark:bg-slate-800">
      <BoardSidebarContent />
    </aside>
  );
}

// Ngăn điều hướng cho điện thoại (dưới 768px) khi đang xem bảng
export function BoardMobileNav({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <NavDrawer open={open} onClose={onClose} label="Các bảng của bạn">
      <BoardSidebarContent />
    </NavDrawer>
  );
}
