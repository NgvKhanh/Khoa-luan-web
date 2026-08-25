import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { assertProjectMember } from '../project/project.service';
import { getActiveTaskOrThrow } from '../task/task.service';
import type { AddDependencyInput } from './taskDependency.schema';

const RELATED_TASK_SELECT = {
  id: true,
  title: true,
  status: true,
  priority: true,
  dueDate: true,
} as const;

/**
 * Kiem tra neu them canh (taskId -> dependsOnTaskId) thi co tao vong lap khong.
 * Duyet tu dependsOnTaskId theo cac canh "phu thuoc" da co san, neu quay lai
 * gap taskId thi nghia la se tao vong lap.
 */
async function wouldCreateCycle(taskId: string, dependsOnTaskId: string) {
  const visited = new Set<string>();
  let frontier = [dependsOnTaskId];

  while (frontier.length > 0) {
    if (frontier.includes(taskId)) {
      return true;
    }

    const newlyVisited = frontier.filter((id) => !visited.has(id));
    newlyVisited.forEach((id) => visited.add(id));

    if (newlyVisited.length === 0) break;

    const edges = await prisma.taskDependency.findMany({
      where: { taskId: { in: newlyVisited }, deletedAt: null },
      select: { dependsOnTaskId: true },
    });

    frontier = edges.map((e) => e.dependsOnTaskId);
  }

  return false;
}

export async function addDependency(
  userId: string,
  taskId: string,
  input: AddDependencyInput
) {
  const task = await getActiveTaskOrThrow(taskId);
  await assertProjectMember(task.projectId, userId);

  if (taskId === input.dependsOnTaskId) {
    throw new AppError('Cong viec khong the phu thuoc vao chinh no', 400);
  }

  const dependsOnTask = await getActiveTaskOrThrow(input.dependsOnTaskId);
  if (dependsOnTask.projectId !== task.projectId) {
    throw new AppError('Chi co the thiet lap phu thuoc giua cac cong viec cung du an', 400);
  }

  const existing = await prisma.taskDependency.findUnique({
    where: {
      taskId_dependsOnTaskId: { taskId, dependsOnTaskId: input.dependsOnTaskId },
    },
  });
  if (existing && existing.deletedAt === null) {
    throw new AppError('Quan he phu thuoc nay da ton tai', 409);
  }

  if (await wouldCreateCycle(taskId, input.dependsOnTaskId)) {
    throw new AppError(
      'Khong the them: thao tac nay se tao ra vong lap phu thuoc',
      400
    );
  }

  const dependency = existing
    ? await prisma.taskDependency.update({
        where: { id: existing.id },
        data: { deletedAt: null },
        include: { dependsOnTask: { select: RELATED_TASK_SELECT } },
      })
    : await prisma.taskDependency.create({
        data: { taskId, dependsOnTaskId: input.dependsOnTaskId },
        include: { dependsOnTask: { select: RELATED_TASK_SELECT } },
      });

  return dependency;
}

export async function listDependencies(userId: string, taskId: string) {
  const task = await getActiveTaskOrThrow(taskId);
  await assertProjectMember(task.projectId, userId);

  const [blockedBy, blocking] = await Promise.all([
    prisma.taskDependency.findMany({
      where: { taskId, deletedAt: null },
      include: { dependsOnTask: { select: RELATED_TASK_SELECT } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.taskDependency.findMany({
      where: { dependsOnTaskId: taskId, deletedAt: null },
      include: { task: { select: RELATED_TASK_SELECT } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  return { blockedBy, blocking };
}

export async function removeDependency(userId: string, dependencyId: string) {
  const dependency = await prisma.taskDependency.findFirst({
    where: { id: dependencyId, deletedAt: null },
  });
  if (!dependency) {
    throw new AppError('Khong tim thay quan he phu thuoc', 404);
  }

  const task = await getActiveTaskOrThrow(dependency.taskId);
  await assertProjectMember(task.projectId, userId);

  await prisma.taskDependency.update({
    where: { id: dependencyId },
    data: { deletedAt: new Date() },
  });
}
