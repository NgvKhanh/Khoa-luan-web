import { api } from '../axios';
import type { BoardList } from '../../types/list';

// Tai toan bo cot + the cua 1 du an (dung cho trang Board)
export async function fetchBoardLists(projectId: string): Promise<BoardList[]> {
  const res = await api.get<{ data: { lists: BoardList[] } }>(
    `/projects/${projectId}/lists`
  );
  return res.data.data.lists;
}

export async function createList(
  projectId: string,
  name: string
): Promise<BoardList> {
  const res = await api.post<{ data: { list: Omit<BoardList, 'tasks'> } }>(
    `/projects/${projectId}/lists`,
    { name }
  );
  return { ...res.data.data.list, tasks: [] };
}

// Doi ten (name) hoac keo sap xep lai cot (position = chi so dich, tu 0)
export async function updateList(
  listId: string,
  input: { name?: string; position?: number }
): Promise<Omit<BoardList, 'tasks'>> {
  const res = await api.patch<{ data: { list: Omit<BoardList, 'tasks'> } }>(
    `/lists/${listId}`,
    input
  );
  return res.data.data.list;
}

export async function deleteList(listId: string): Promise<void> {
  await api.delete(`/lists/${listId}`);
}
