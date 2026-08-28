import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { assertBoardOwner } from '../board/board.service';
import type { CreateListInput, UpdateListInput } from './list.schema';

// Lay 1 danh sach con hoat dong va kiem tra nguoi dung so huu bang chua no
async function getOwnListOrThrow(userId: string, listId: string) {
  const list = await prisma.list.findFirst({
    where: { id: listId, deletedAt: null },
  });
  if (!list) {
    throw new AppError('Khong tim thay danh sach', 404);
  }
  await assertBoardOwner(userId, list.boardId);
  return list;
}

export async function listBoardLists(userId: string, boardId: string) {
  await assertBoardOwner(userId, boardId);
  return prisma.list.findMany({
    where: { boardId, deletedAt: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });
}

export async function createList(
  userId: string,
  boardId: string,
  input: CreateListInput
) {
  await assertBoardOwner(userId, boardId);

  // Dat danh sach moi vao cuoi (position lon nhat hien co + 1)
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
  await getOwnListOrThrow(userId, listId);
  return prisma.list.update({
    where: { id: listId },
    data: { ...(input.name !== undefined ? { name: input.name } : {}) },
  });
}

export async function deleteList(userId: string, listId: string) {
  await getOwnListOrThrow(userId, listId);
  await prisma.list.update({
    where: { id: listId },
    data: { deletedAt: new Date() },
  });
}
