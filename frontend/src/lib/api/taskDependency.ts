import { api } from '../axios';
import type { TaskDependencies } from '../../types/taskDependency';

export async function fetchDependencies(taskId: string): Promise<TaskDependencies> {
  const res = await api.get<{ data: TaskDependencies }>(
    `/tasks/${taskId}/dependencies`
  );
  return res.data.data;
}

export async function addDependency(
  taskId: string,
  dependsOnTaskId: string
): Promise<void> {
  await api.post(`/tasks/${taskId}/dependencies`, { dependsOnTaskId });
}

export async function removeDependency(dependencyId: string): Promise<void> {
  await api.delete(`/dependencies/${dependencyId}`);
}
