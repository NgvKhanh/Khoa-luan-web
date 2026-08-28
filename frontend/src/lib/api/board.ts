import { api } from '../axios';
import type { Board } from '../../types/board';

export async function fetchMyBoards(): Promise<Board[]> {
  const res = await api.get<{ data: { boards: Board[] } }>('/boards');
  return res.data.data.boards;
}

export async function createBoard(input: {
  name: string;
  color?: string;
}): Promise<Board> {
  const res = await api.post<{ data: { board: Board } }>('/boards', input);
  return res.data.data.board;
}

export async function updateBoard(
  boardId: string,
  input: { name?: string; color?: string }
): Promise<Board> {
  const res = await api.patch<{ data: { board: Board } }>(
    `/boards/${boardId}`,
    input
  );
  return res.data.data.board;
}

export async function deleteBoard(boardId: string): Promise<void> {
  await api.delete(`/boards/${boardId}`);
}
