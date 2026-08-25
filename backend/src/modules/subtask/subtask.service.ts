import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { assertProjectMember } from '../project/project.service';
import { getActiveTaskOrThrow } from '../task/task.service';
import type { CreateSubtaskInput, UpdateSubtaskInput } from './subtask.schema';

async function getActiveSubtaskOrThrow(subtaskId: string) {
  const subtask = await prisma.subtask.findFirst({
    where: { id: subtaskId, deletedAt: null },
  });
  if (!subtask) {
    throw new AppError('Khong tim thay cong viec con', 404);
  }
  return subtask;
}

export async function createSubtask(
  userId: string,
  taskId: string,
  input: CreateSubtaskInput
) {
  const task = await getActiveTaskOrThrow(taskId);
  await assertProjectMember(task.projectId, userId);

  return prisma.subtask.create({
    data: { taskId, title: input.title },
  });
}

export async function listSubtasks(userId: string, taskId: string) {
  const task = await getActiveTaskOrThrow(taskId);
  await assertProjectMember(task.projectId, userId);

  return prisma.subtask.findMany({
    where: { taskId, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  });
}

export async function updateSubtask(
  userId: string,
  subtaskId: string,
  input: UpdateSubtaskInput
) {
  const subtask = await getActiveSubtaskOrThrow(subtaskId);
  const task = await getActiveTaskOrThrow(subtask.taskId);
  await assertProjectMember(task.projectId, userId);

  if (Object.keys(input).length === 0) {
    throw new AppError('Khong co du lieu nao de cap nhat', 400);
  }

  return prisma.subtask.update({
    where: { id: subtaskId },
    data: input,
  });
}

export async function deleteSubtask(userId: string, subtaskId: string) {
  const subtask = await getActiveSubtaskOrThrow(subtaskId);
  const task = await getActiveTaskOrThrow(subtask.taskId);
  await assertProjectMember(task.projectId, userId);

  await prisma.subtask.update({
    where: { id: subtaskId },
    data: { deletedAt: new Date() },
  });
}
