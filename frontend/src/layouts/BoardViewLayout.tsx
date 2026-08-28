import { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import BoardSidebar from '../components/BoardSidebar';
import Header from '../components/Header';
import { fetchMyBoards } from '../lib/api/board';
import { getErrorMessage } from '../lib/errorMessage';
import type { Board } from '../types/board';

export interface BoardOutletContext {
  boards: Board[];
  isLoading: boolean;
  error: string | null;
  patchBoard: (board: Board) => void;
}

// Layout khi dang xem 1 bang: Header giu nguyen, sidebar doi thanh sidebar cua bang.
export default function BoardViewLayout() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyBoards()
      .then(setBoards)
      .catch((err) =>
        setError(getErrorMessage(err, 'Không tải được danh sách bảng.'))
      )
      .finally(() => setIsLoading(false));
  }, []);

  function patchBoard(updated: Board) {
    setBoards((list) => list.map((b) => (b.id === updated.id ? updated : b)));
  }

  const ctx: BoardOutletContext = { boards, isLoading, error, patchBoard };

  return (
    <div className="flex h-screen flex-col">
      <Header />
      <div className="flex min-h-0 flex-1">
        <BoardSidebar boards={boards} />
        <main className="min-w-0 flex-1 overflow-hidden">
          <Outlet context={ctx} />
        </main>
      </div>
    </div>
  );
}
