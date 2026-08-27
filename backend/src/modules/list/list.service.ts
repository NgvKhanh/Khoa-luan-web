import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { assertProjectMember } from '../project/project.service';
import { TASK_INCLUDE } from '../task/task.service';
import type { CreateListInput, UpdateListInput } from './list.schema';

async function getActiveListOrThrow(listId: string) {
  const list = await prisma.list.findFirst({
    where: { id: listId, deletedAt: null },
  });
  if (!list) {
    throw new AppError('Khong tim thay danh sach', 404);
  }
  return list;
}

/**
 * Tra ve toan bo danh sach (cot) cua 1 du an, kem cac the ben trong,
 * da sap xep theo position. Dung cho trang Board (1 lan goi la du du lieu).
 */
export async function listProjectLists(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
  });
  if (!project) {
    throw new AppError('Khong tim thay du an', 404);
  }
  await assertProjectMember(projectId, userId);

  return prisma.list.findMany({
    where: { projectId, deletedAt: null },
    orderBy: { position: 'asc' },
    include: {
      tasks: {
        where: { deletedAt: null },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        include: TASK_INCLUDE,
      },
    },
  });
}

export async function createList(
  userId: string,
  projectId: string,
  input: CreateListInput
) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
  });
  if (!project) {
    throw new AppError('Khong tim thay du an', 404);
  }
  await assertProjectMember(projectId, userId);

  // Dat cot moi vao cuoi cung (position lon nhat + 1)
  const last = await prisma.list.findFirst({
    where: { projectId, deletedAt: null },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const nextPosition = last ? last.position + 1 : 0;

  return prisma.list.create({
    data: { projectId, name: input.name, position: nextPosition },
  });
}

export async function updateList(
  userId: string,
  listId: string,
  input: UpdateListInput
) {
  const list = await getActiveListOrThrow(listId);
  await assertProjectMember(list.projectId, userId);

  // Doi ten (neu co)
  if (input.name !== undefined && input.position === undefined) {
    return prisma.list.update({
      where: { id: listId },
      data: { name: input.name },
    });
  }

  // Keo sap xep lai: dua cot nay toi vi tri input.position, roi danh so lai toan bo
  if (input.position !== undefined) {
    const others = await prisma.list.findMany({
      where: { projectId: list.projectId, deletedAt: null, id: { not: listId } },
      orderBy: { position: 'asc' },
      select: { id: true },
    });

    const targetIndex = Math.min(input.position, others.length);
    const orderedIds = [
      ...others.slice(0, targetIndex).map((l) => l.id),
      listId,
      ...others.slice(targetIndex).map((l) => l.id),
    ];

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.list.update({
          where: { id },
          data: {
            position: index,
            ...(id === listId && input.name !== undefined
              ? { name: input.name }
              : {}),
          },
        })
      )
    );

    return getActiveListOrThrow(listId);
  }

  return list;
}

export async function deleteList(userId: string, listId: string) {
  const list = await getActiveListOrThrow(listId);
  await assertProjectMember(list.projectId, userId);

  const taskCount = await prisma.task.count({
    where: { listId, deletedAt: null },
  });
  if (taskCount > 0) {
    throw new AppError(
      'Hay chuyen hoac xoa het the trong danh sach nay truoc khi xoa',
      400
    );
  }

  await prisma.list.update({
    where: { id: listId },
    data: { deletedAt: new Date() },
  });
}
