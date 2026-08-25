import { api } from '../axios';
import type { Task, TaskPriority, TaskStatus } from '../../types/task';

export async function fetchProjectTasks(projectId: string): Promise<Task[]> {
  const res = await api.get<{ data: { tasks: Task[] } }>(
    `/projects/${projectId}/tasks`
  );
  return res.data.data.tasks;
}

export async function fetchTaskDetail(taskId: string): Promise<Task> {
  const res = await api.get<{ data: { task: Task } }>(`/tasks/${taskId}`);
  return res.data.data.task;
}

export async function createTask(
  projectId: string,
  input: {
    title: string;
    description?: string;
    assigneeId?: string;
    priority?: TaskPriority;
    startDate?: string;
    dueDate?: string;
  }
): Promise<Task> {
  const res = await api.post<{ data: { task: Task } }>(
    `/projects/${projectId}/tasks`,
    input
  );
  return res.data.data.task;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  assigneeId?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
  startDate?: string | null;
  dueDate?: string | null;
  progress?: number;
  estimatedHours?: number | null;
  actualHours?: number | null;
  blockedReason?: string | null;
}

export async function updateTask(
  taskId: string,
  input: UpdateTaskInput
): Promise<Task> {
  const res = await api.patch<{ data: { task: Task } }>(
    `/tasks/${taskId}`,
    input
  );
  return res.data.data.task;
}

export async function deleteTask(taskId: string): Promise<void> {
  await api.delete(`/tasks/${taskId}`);
}
