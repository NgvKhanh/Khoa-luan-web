import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { assertBoardAccess } from '../board/board.service';
import { assertListAccess } from '../list/list.service';
import type {
  CreateCardInput,
  MoveCardInput,
  UpdateCardInput,
} from './card.schema';

// Lay 1 the con hoat dong + kiem tra nguoi dung so huu bang chua no
async function assertCardAccess(userId: string, cardId: string) {
  const card = await prisma.card.findFirst({
    where: { id: cardId, deletedAt: null },
  });
  if (!card) {
    throw new AppError('Khong tim thay the', 404);
  }
  await assertListAccess(userId, card.listId);
  return card;
}

export async function createCard(
  userId: string,
  listId: string,
  input: CreateCardInput
) {
  await assertListAccess(userId, listId);

  const last = await prisma.card.findFirst({
    where: { listId, deletedAt: null },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = last ? last.position + 1 : 0;

  return prisma.card.create({
    data: { listId, title: input.title, position },
  });
}

export async function updateCard(
  userId: string,
  cardId: string,
  input: UpdateCardInput
) {
  await assertCardAccess(userId, cardId);
  return prisma.card.update({
    where: { id: cardId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.isDone !== undefined ? { isDone: input.isDone } : {}),
    },
  });
}

export async function deleteCard(userId: string, cardId: string) {
  await assertCardAccess(userId, cardId);
  await prisma.card.update({
    where: { id: cardId },
    data: { deletedAt: new Date() },
  });
}

/**
 * Keo tha the: chuyen sang danh sach `listId`, chen vao vi tri `position`.
 * Sau khi chen se danh so lai position cua danh sach nguon va danh sach dich
 * de thu tu luon lien mach (0,1,2...).
 */
export async function moveCard(
  userId: string,
  cardId: string,
  input: MoveCardInput
) {
  const card = await assertCardAccess(userId, cardId);

  const targetList = await prisma.list.findFirst({
    where: { id: input.listId, deletedAt: null },
  });
  if (!targetList) {
    throw new AppError('Danh sach dich khong ton tai', 400);
  }
  await assertBoardAccess(userId, targetList.boardId);

  const sourceList = await prisma.list.findFirst({
    where: { id: card.listId },
    select: { boardId: true },
  });
  if (sourceList && sourceList.boardId !== targetList.boardId) {
    throw new AppError('Khong the chuyen the sang bang khac', 400);
  }

  const sourceListId = card.listId;

  const targetCards = await prisma.card.findMany({
    where: { listId: input.listId, deletedAt: null, id: { not: cardId } },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  const index = Math.min(Math.max(input.position, 0), targetCards.length);
  const orderedIds = [
    ...targetCards.slice(0, index).map((c) => c.id),
    cardId,
    ...targetCards.slice(index).map((c) => c.id),
  ];

  const writes = orderedIds.map((id, i) =>
    prisma.card.update({
      where: { id },
      data: { position: i, listId: input.listId },
    })
  );

  if (sourceListId !== input.listId) {
    const remaining = await prisma.card.findMany({
      where: { listId: sourceListId, deletedAt: null, id: { not: cardId } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    remaining.forEach((c, i) => {
      writes.push(
        prisma.card.update({ where: { id: c.id }, data: { position: i } })
      );
    });
  }

  await prisma.$transaction(writes);

  return prisma.card.findFirst({ where: { id: cardId } });
}
