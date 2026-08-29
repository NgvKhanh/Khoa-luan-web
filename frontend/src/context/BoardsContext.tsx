import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { fetchMyBoards, setBoardStar } from '../lib/api/board';
import { getErrorMessage } from '../lib/errorMessage';
import type { Board } from '../types/board';

interface BoardsContextValue {
  boards: Board[];
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  // Them moi hoac cap nhat 1 bang trong danh sach (dung sau khi tao/sua)
  upsertBoard: (board: Board) => void;
  removeBoard: (boardId: string) => void;
  // Danh dau / bo sao (cap nhat ngay, tu goi API)
  toggleStar: (boardId: string) => void;
}

const BoardsContext = createContext<BoardsContextValue | undefined>(undefined);

// Nguon du lieu bang dung chung: Header (tim kiem, tao moi), Sidebar, trang chu.
export function BoardsProvider({ children }: { children: ReactNode }) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      setBoards(await fetchMyBoards());
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được danh sách bảng.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const upsertBoard = useCallback((board: Board) => {
    setBoards((cur) => {
      const idx = cur.findIndex((b) => b.id === board.id);
      if (idx === -1) return [board, ...cur];
      const next = [...cur];
      next[idx] = { ...next[idx], ...board };
      return next;
    });
  }, []);

  const removeBoard = useCallback((boardId: string) => {
    setBoards((cur) => cur.filter((b) => b.id !== boardId));
  }, []);

  const toggleStar = useCallback((boardId: string) => {
    let next = false;
    setBoards((cur) =>
      cur.map((b) => {
        if (b.id !== boardId) return b;
        next = !b.isStarred;
        return { ...b, isStarred: next };
      })
    );
    setBoardStar(boardId, next).catch(() => {
      // hoan tac neu that bai
      setBoards((cur) =>
        cur.map((b) =>
          b.id === boardId ? { ...b, isStarred: !next } : b
        )
      );
    });
  }, []);

  return (
    <BoardsContext.Provider
      value={{
        boards,
        isLoading,
        error,
        reload,
        upsertBoard,
        removeBoard,
        toggleStar,
      }}
    >
      {children}
    </BoardsContext.Provider>
  );
}

export function useBoards(): BoardsContextValue {
  const ctx = useContext(BoardsContext);
  if (!ctx) {
    throw new Error('useBoards phải được dùng bên trong BoardsProvider');
  }
  return ctx;
}
