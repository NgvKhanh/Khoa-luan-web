import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { assertBoardAccess } from '../board/board.service';
import type { CreateListInput, UpdateListInput } from './list.schema';

// Lay 1 danh sach con hoat dong va kiem tra nguoi dung so huu bang chua no.
// Export de module card tai su dung.
export async function assertListAccess(userId: string, listId: string) {
  const list = await prisma.list.findFirst({
    where: { id: listId, deletedAt: null },
  });
  if (!list) {
    throw new AppError('Khong tim thay danh sach', 404);
  }
  await assertBoardAccess(userId, list.boardId);
  return list;
}

export async function listBoardLists(userId: string, boardId: string) {
  await assertBoardAccess(userId, boardId);
  return prisma.list.findMany({
    where: { boardId, deletedAt: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: {
      cards: {
        where: { deletedAt: null },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });
}

export async function createList(
  userId: string,
  boardId: string,
  input: CreateListInput
) {
  await assertBoardAccess(userId, boardId);

  const last = await prisma.list.findFirst({
    where: { boardId, deletedAt: null },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = last ? last.position + 1 : 0;

  return prisma.list.create({
    data: { boardId, name: input.name, position },
  });
}

export async function updateList(
  userId: string,
  listId: string,
  input: UpdateListInput
) {
  const list = await assertListAccess(userId, listId);

  // Keo sap xep lai: dua cot nay toi vi tri input.position roi danh so lai het
  if (input.position !== undefined) {
    const others = await prisma.list.findMany({
      where: { boardId: list.boardId, deletedAt: null, id: { not: listId } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    const target = Math.min(Math.max(input.position, 0), others.length);
    const orderedIds = [
      ...others.slice(0, target).map((l) => l.id),
      listId,
      ...others.slice(target).map((l) => l.id),
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

    return prisma.list.findFirst({ where: { id: listId } });
  }

  return prisma.list.update({
    where: { id: listId },
    data: { ...(input.name !== undefined ? { name: input.name } : {}) },
  });
}

export async function deleteList(userId: string, listId: string) {
  await assertListAccess(userId, listId);
  await prisma.list.update({
    where: { id: listId },
    data: { deletedAt: new Date() },
  });
}
