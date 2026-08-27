import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { logActivity } from '../activity-log/activityLog.service';
import { assertProjectMember } from '../project/project.service';
import type {
  CreateTaskInput,
  MoveTaskInput,
  TaskQueryInput,
  UpdateTaskInput,
} from './task.schema';

export const TASK_INCLUDE = {
  creator: { select: { id: true, name: true, email: true, avatarUrl: true } },
  assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
} as const;

export async function getActiveTaskOrThrow(taskId: string) {
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

// Tra ve cot (List) hop le thuoc dung du an. Neu khong truyen listId thi lay cot dau tien.
async function resolveListForProject(
  projectId: string,
  listId: string | undefined
) {
  if (listId) {
    const list = await prisma.list.findFirst({
      where: { id: listId, projectId, deletedAt: null },
    });
    if (!list) {
      throw new AppError('Cot khong ton tai trong du an nay', 400);
    }
    return list;
  }
  return prisma.list.findFirst({
    where: { projectId, deletedAt: null },
    orderBy: { position: 'asc' },
  });
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

  const list = await resolveListForProject(projectId, input.listId);

  // The moi xep xuong cuoi cot
  const lastInList = list
    ? await prisma.task.findFirst({
        where: { listId: list.id, deletedAt: null },
        orderBy: { position: 'desc' },
        select: { position: true },
      })
    : null;
  const nextPosition = lastInList ? lastInList.position + 1 : 0;

  const task = await prisma.task.create({
    data: {
      projectId,
      listId: list?.id ?? null,
      position: nextPosition,
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

export async function listProjectTasks(
  userId: string,
  projectId: string,
  query: TaskQueryInput
) {
  await assertProjectMember(projectId, userId);

  const where = {
    projectId,
    deletedAt: null,
    ...(query.search
      ? { title: { contains: query.search, mode: 'insensitive' as const } }
      : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.priority ? { priority: query.priority } : {}),
    ...(query.assigneeId ? { assigneeId: query.assigneeId } : {}),
  };

  const sortBy = query.sortBy ?? 'createdAt';
  const sortOrder = query.sortOrder ?? (sortBy === 'dueDate' ? 'asc' : 'desc');
  const orderBy =
    sortBy === 'dueDate'
      ? { dueDate: { sort: sortOrder, nulls: 'last' as const } }
      : { createdAt: sortOrder };

  const total = await prisma.task.count({ where });

  // Chi phan trang khi client thuc su yeu cau (co truyen page hoac pageSize),
  // de trang Kanban van goi duoc toan bo cong viec ma khong bi cat bot.
  const shouldPaginate = query.page !== undefined || query.pageSize !== undefined;
  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 20;

  const tasks = await prisma.task.findMany({
    where,
    include: TASK_INCLUDE,
    orderBy,
    ...(shouldPaginate
      ? { skip: (page - 1) * pageSize, take: pageSize }
      : {}),
  });

  return {
    tasks,
    pagination: {
      page,
      pageSize: shouldPaginate ? pageSize : total,
      total,
      totalPages: shouldPaginate ? Math.max(1, Math.ceil(total / pageSize)) : 1,
    },
  };
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

/**
 * Keo tha the tren bang: chuyen the sang cot `listId` va chen vao vi tri `position`.
 * Sau khi chen se danh so lai position cua cac the trong cot nguon va cot dich
 * de thu tu luon lien mach (0,1,2...).
 */
export async function moveTask(
  userId: string,
  taskId: string,
  input: MoveTaskInput
) {
  const task = await getActiveTaskOrThrow(taskId);
  await assertProjectMember(task.projectId, userId);

  const targetList = await prisma.list.findFirst({
    where: { id: input.listId, projectId: task.projectId, deletedAt: null },
  });
  if (!targetList) {
    throw new AppError('Cot dich khong ton tai trong du an nay', 400);
  }

  const sourceListId = task.listId;

  // Danh sach the trong cot dich (khong tinh the dang keo), theo thu tu hien tai
  const targetTasks = await prisma.task.findMany({
    where: { listId: targetList.id, deletedAt: null, id: { not: taskId } },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });

  const targetIndex = Math.min(Math.max(input.position, 0), targetTasks.length);
  const orderedIds = [
    ...targetTasks.slice(0, targetIndex).map((t) => t.id),
    taskId,
    ...targetTasks.slice(targetIndex).map((t) => t.id),
  ];

  const writes = [
    ...orderedIds.map((id, index) =>
      prisma.task.update({
        where: { id },
        data: { position: index, listId: targetList.id },
      })
    ),
  ];

  // Neu doi cot, danh so lai cot nguon cho lien mach
  if (sourceListId && sourceListId !== targetList.id) {
    const remaining = await prisma.task.findMany({
      where: { listId: sourceListId, deletedAt: null, id: { not: taskId } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    remaining.forEach((row, index) => {
      writes.push(
        prisma.task.update({ where: { id: row.id }, data: { position: index } })
      );
    });
  }

  await prisma.$transaction(writes);

  return prisma.task.findFirst({ where: { id: taskId }, include: TASK_INCLUDE });
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
