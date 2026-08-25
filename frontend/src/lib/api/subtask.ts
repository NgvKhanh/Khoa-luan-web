import { api } from '../axios';
import type { Subtask } from '../../types/subtask';

export async function fetchSubtasks(taskId: string): Promise<Subtask[]> {
  const res = await api.get<{ data: { subtasks: Subtask[] } }>(
    `/tasks/${taskId}/subtasks`
  );
  return res.data.data.subtasks;
}

export async function createSubtask(
  taskId: string,
  title: string
): Promise<Subtask> {
  const res = await api.post<{ data: { subtask: Subtask } }>(
    `/tasks/${taskId}/subtasks`,
    { title }
  );
  return res.data.data.subtask;
}

export async function updateSubtask(
  subtaskId: string,
  input: { title?: string; isDone?: boolean }
): Promise<Subtask> {
  const res = await api.patch<{ data: { subtask: Subtask } }>(
    `/subtasks/${subtaskId}`,
    input
  );
  return res.data.data.subtask;
}

export async function deleteSubtask(subtaskId: string): Promise<void> {
  await api.delete(`/subtasks/${subtaskId}`);
}
