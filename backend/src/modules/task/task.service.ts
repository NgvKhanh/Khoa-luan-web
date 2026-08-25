import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { logActivity } from '../activity-log/activityLog.service';
import { assertProjectMember } from '../project/project.service';
import type { CreateTaskInput, UpdateTaskInput } from './task.schema';

const TASK_INCLUDE = {
  creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
  assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
} as const;

async function getActiveTaskOrThrow(taskId: string) {
  const task = await prisma.task.findFirst({
    where: { id: taskId, deletedAt: null },
  });
  if (!task) {
    throw new AppError('Khong tim thay cong viec', 404);
  }
  return task;
}

async function assertAssigneeIsProjectMember(projectId: string, userId: string) {
  const membership = await prisma.projectMember.findFirst({
    where: { projectId, userId, deletedAt: null },
  });
  if (!membership) {
    throw new AppError(
      'Nguoi duoc giao viec phai la thanh vien cua du an',
      400
    );
  }
}

export async function createTask(
  userId: string,
  projectId: string,
  input: CreateTaskInput
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
  });
  if (!project) {
    throw new AppError('Khong tim thay du an', 404);
  }

  await assertProjectMember(projectId, userId);

  if (input.assigneeId) {
    await assertAssigneeIsProjectMember(projectId, input.assigneeId);
  }

  const task = await prisma.task.create({
    data: {
      projectId,
      creatorId: userId,
      title: input.title,
      description: input.description,
      assigneeId: input.assigneeId,
      priority: input.priority,
      startDate: input.startDate,
      dueDate: input.dueDate,
      estimatedHours: input.estimatedHours,
    },
    include: TASK_INCLUDE,
  });

  await logActivity({
    entityType: 'TASK',
    entityId: task.id,
    action: 'CREATED',
    newValue: task.title,
    actorId: userId,
  });

  return task;
}

export async function listProjectTasks(userId: string, projectId: string) {
  await assertProjectMember(projectId, userId);

  return prisma.task.findMany({
    where: { projectId, deletedAt: null },
    include: TASK_INCLUDE,
    orderBy: { createdAt: 'desc' },
  });
}

export async function getTaskDetail(userId: string, taskId: string) {
  const task = await getActiveTaskOrThrow(taskId);
  await assertProjectMember(task.projectId, userId);

  return prisma.task.findFirst({
    where: { id: taskId },
    include: {
      ...TASK_INCLUDE,
      subtasks: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
    },
  });
}

function dateOrEmpty(date: Date | null): string {
  return date ? date.toISOString() : '';
}

export async function updateTask(
  userId: string,
  taskId: string,
  input: UpdateTaskInput
) {
  const task = await getActiveTaskOrThrow(taskId);
  await assertProjectMember(task.projectId, userId);

  if (Object.keys(input).length === 0) {
    throw new AppError('Khong co du lieu nao de cap nhat', 400);
  }

  if (input.assigneeId) {
    await assertAssigneeIsProjectMember(task.projectId, input.assigneeId);
  }

  const nextStatus = input.status ?? task.status;
  const nextBlockedReason =
    input.blockedReason !== undefined ? input.blockedReason : task.blockedReason;

  if (nextStatus === 'BLOCKED' && !nextBlockedReason) {
    throw new AppError('Vui long nhap ly do khi danh dau cong viec la Bi chan', 400);
  }

  const data: Record<string, unknown> = { ...input };

  // Khi chuyen khoi trang thai BLOCKED va nguoi dung khong tu nhap ly do moi, tu xoa ly do cu
  if (task.status === 'BLOCKED' && nextStatus !== 'BLOCKED' && input.blockedReason === undefined) {
    data.blockedReason = null;
  }

  const logEntry = (action: string, oldValue: string | null, newValue: string | null) =>
    prisma.activityLog.create({
      data: { entityType: 'TASK', entityId: taskId, action, oldValue, newValue, actorId: userId },
    });

  const activityWrites = [];

  if (input.status !== undefined && input.status !== task.status) {
    activityWrites.push(logEntry('STATUS_CHANGED', task.status, input.status));
  }
  if (input.progress !== undefined && input.progress !== task.progress) {
    activityWrites.push(
      logEntry('PROGRESS_UPDATED', String(task.progress), String(input.progress))
    );
  }
  if (
    input.dueDate !== undefined &&
    dateOrEmpty(input.dueDate) !== dateOrEmpty(task.dueDate)
  ) {
    activityWrites.push(
      logEntry('DEADLINE_CHANGED', dateOrEmpty(task.dueDate), dateOrEmpty(input.dueDate))
    );
  }
  if (input.assigneeId !== undefined && input.assigneeId !== task.assigneeId) {
    activityWrites.push(logEntry('ASSIGNEE_CHANGED', task.assigneeId, input.assigneeId));
  }

  const [updatedTask] = await prisma.$transaction([
    prisma.task.update({ where: { id: taskId }, data, include: TASK_INCLUDE }),
    ...activityWrites,
  ]);

  return updatedTask;
}

export async function deleteTask(userId: string, taskId: string) {
  const task = await getActiveTaskOrThrow(taskId);
  await assertProjectMember(task.projectId, userId);

  const now = new Date();

  await prisma.$transaction([
    prisma.task.update({ where: { id: taskId }, data: { deletedAt: now } }),
    prisma.subtask.updateMany({
      where: { taskId, deletedAt: null },
      data: { deletedAt: now },
    }),
    prisma.taskDependency.updateMany({
      where: { OR: [{ taskId }, { dependsOnTaskId: taskId }], deletedAt: null },
      data: { deletedAt: now },
    }),
    prisma.comment.updateMany({
      where: { taskId, deletedAt: null },
      data: { deletedAt: now },
    }),
    prisma.attachment.updateMany({
      where: { taskId, deletedAt: null },
      data: { deletedAt: now },
    }),
  ]);
}
