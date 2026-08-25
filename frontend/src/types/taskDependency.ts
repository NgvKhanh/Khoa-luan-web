import type { TaskPriority, TaskStatus } from './task';

export interface RelatedTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
}

export interface BlockedByDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  dependsOnTask: RelatedTask;
}

export interface BlockingDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  task: RelatedTask;
}

export interface TaskDependencies {
  blockedBy: BlockedByDependency[];
  blocking: BlockingDependency[];
}
