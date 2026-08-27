import { api } from '../axios';
import type { Task, TaskPriority, TaskStatus } from '../../types/task';

export interface TaskListQuery {
  search?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assigneeId?: string;
  sortBy?: 'dueDate' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface TaskListResult {
  tasks: Task[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
}

export async function fetchProjectTasks(
  projectId: string,
  query: TaskListQuery = {}
): Promise<Task[]> {
  const res = await api.get<{ data: TaskListResult }>(
    `/projects/${projectId}/tasks`,
    { params: query }
  );
  return res.data.data.tasks;
}

export async function fetchProjectTasksPaged(
  projectId: string,
  query: TaskListQuery
): Promise<TaskListResult> {
  const res = await api.get<{ data: TaskListResult }>(
    `/projects/${projectId}/tasks`,
    { params: query }
  );
  return res.data.data;
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
    listId?: string;
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

// Keo tha the sang cot khac / doi thu tu: position la chi so dich trong cot (tu 0)
export async function moveTask(
  taskId: string,
  input: { listId: string; position: number }
): Promise<Task> {
  const res = await api.patch<{ data: { task: Task } }>(
    `/tasks/${taskId}/move`,
    input
  );
  return res.data.data.task;
}

export async function deleteTask(taskId: string): Promise<void> {
  await api.delete(`/tasks/${taskId}`);
}
