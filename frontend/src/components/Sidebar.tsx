import { NavLink } from 'react-router-dom';
import { useBoards } from '../context/BoardsContext';
import { assetUrl } from '../lib/assets';
import type { Board } from '../types/board';

const ACTIVE =
  'flex items-center gap-2 rounded px-3 py-2 text-sm bg-[#e9f2ff] font-semibold text-[#0c66e4]';
const INACTIVE =
  'flex items-center gap-2 rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100';

function BoardSwatch({ board }: { board: Board }) {
  const style = board.backgroundImage
    ? {
        backgroundImage: `url(${assetUrl(board.backgroundImage)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { backgroundColor: board.color };
  return <span className="h-4 w-5 shrink-0 rounded-[3px]" style={style} />;
}

export default function Sidebar() {
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

      <div className="p-2">
        <NavLink
          to="/"
          end
          className={({ isActive }) => (isActive ? ACTIVE : INACTIVE)}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-500" fill="currentColor">
            <rect x="3" y="4" width="8" height="16" rx="1" />
            <rect x="13" y="4" width="8" height="10" rx="1" />
          </svg>
          Bảng
        </NavLink>
      </div>

      <div className="border-t border-slate-200" />

      <div className="flex-1 overflow-y-auto p-2">
        <p className="px-3 pb-1 pt-1 text-xs font-semibold text-slate-500">
          Các bảng của bạn
        </p>
        <nav className="flex flex-col gap-0.5">
          {boards.map((board) => (
            <NavLink
              key={board.id}
              to={`/boards/${board.id}`}
              className={({ isActive }) => (isActive ? ACTIVE : INACTIVE)}
            >
              <BoardSwatch board={board} />
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
