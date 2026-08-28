import { Link, NavLink } from 'react-router-dom';
import { useBoards } from '../context/BoardsContext';
import { assetUrl } from '../lib/assets';
import type { Board } from '../types/board';

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

// Sidebar khi dang xem 1 bang: header khong gian lam viec + danh sach cac bang.
export default function BoardSidebar() {
  const { boards } = useBoards();

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-gradient-to-br from-[#8bbdd9] to-[#0c66e4] text-xs font-bold text-white">
          K
        </span>
        <span className="truncate text-sm font-semibold text-slate-700">
          Không gian làm việc
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <Link
          to="/"
          className="flex items-center gap-2 rounded px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Tất cả các bảng
        </Link>

        <div className="my-2 border-t border-slate-200" />

        <p className="px-3 pb-1 text-xs font-semibold text-slate-500">
          Các bảng của bạn
        </p>
        <nav className="flex flex-col gap-0.5">
          {boards.map((board) => (
            <NavLink
              key={board.id}
              to={`/boards/${board.id}`}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded px-3 py-2 text-sm ${
                  isActive
                    ? 'bg-[#e9f2ff] font-semibold text-[#0c66e4]'
                    : 'text-slate-700 hover:bg-slate-100'
                }`
              }
            >
              <Swatch board={board} />
              <span className="truncate">{board.name}</span>
            </NavLink>
          ))}
          {boards.length === 0 && (
            <p className="px-3 py-1 text-xs text-slate-400">Chưa có bảng nào.</p>
          )}
        </nav>
      </div>
    </aside>
  );
}
