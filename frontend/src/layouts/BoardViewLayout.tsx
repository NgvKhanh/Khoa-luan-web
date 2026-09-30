import { Outlet } from 'react-router-dom';
import BoardSidebar from '../components/BoardSidebar';
import Header from '../components/Header';
import { useBoards } from '../context/BoardsContext';
import type { Board } from '../types/board';

export interface BoardOutletContext {
  boards: Board[];
  isLoading: boolean;
  error: string | null;
  patchBoard: (board: Board) => void;
}

// Layout khi dang xem 1 bang: Header + Sidebar giu nguyen, chi vung noi dung doi.
export default function BoardViewLayout() {
  const { boards, isLoading, error, upsertBoard } = useBoards();

  const ctx: BoardOutletContext = {
    boards,
    isLoading,
    error,
    patchBoard: upsertBoard,
  };

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        <BoardSidebar />
        <main className="min-w-0 flex-1 overflow-hidden">
          <Outlet context={ctx} />
        </main>
      </div>
    </div>
  );
}
