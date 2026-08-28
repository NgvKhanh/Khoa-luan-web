import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { logActivity } from '../activity/activity.service';
import { assertBoardAccess } from '../board/board.service';
import { cardMemberIds, notify } from '../notification/notification.service';
import { assertListAccess } from '../list/list.service';
import type {
  CreateCardInput,
  MoveCardInput,
  UpdateCardInput,
} from './card.schema';

const CARD_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
} as const;

// Lay 1 the con hoat dong + kiem tra quyen. Tra ve card kem boardId (de ghi log).
export async function assertCardAccess(userId: string, cardId: string) {
  const card = await prisma.card.findFirst({
    where: { id: cardId, deletedAt: null },
    include: { list: { select: { boardId: true, name: true } } },
  });
  if (!card) {
    throw new AppError('Khong tim thay the', 404);
  }
  await assertListAccess(userId, card.listId);
  return card;
}

export async function getCardDetail(userId: string, cardId: string) {
  await assertCardAccess(userId, cardId);
  const card = await prisma.card.findFirst({
    where: { id: cardId, deletedAt: null },
    include: {
      list: { select: { id: true, name: true, boardId: true } },
      members: { include: { user: { select: CARD_USER_SELECT } } },
      labels: { include: { label: true } },
      checklists: {
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        include: {
          items: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
        },
      },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: CARD_USER_SELECT } },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
    },
  });
  if (!card) throw new AppError('Khong tim thay the', 404);
  return card;
}

export async function createCard(
  userId: string,
  listId: string,
  input: CreateCardInput
) {
  const list = await assertListAccess(userId, listId);

  const last = await prisma.card.findFirst({
    where: { listId, deletedAt: null },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = last ? last.position + 1 : 0;

  const card = await prisma.card.create({
    data: { listId, title: input.title, position },
  });

  await logActivity({
    boardId: list.boardId,
    cardId: card.id,
    userId,
    type: 'card.create',
    data: { listName: list.name },
  });

  return card;
}

export async function updateCard(
  userId: string,
  cardId: string,
  input: UpdateCardInput
) {
  const card = await assertCardAccess(userId, cardId);
  const boardId = card.list.boardId;

  const updated = await prisma.card.update({
    where: { id: cardId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
      ...(input.isDone !== undefined ? { isDone: input.isDone } : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
        : {}),
    },
  });

  const recipients = () => cardMemberIds(cardId);

  if (input.title !== undefined && input.title !== card.title) {
    await logActivity({
      boardId,
      cardId,
      userId,
      type: 'card.rename',
      data: { from: card.title, to: input.title },
    });
    await notify({
      recipients: await recipients(),
      actorId: userId,
      type: 'card.renamed',
      boardId,
      cardId,
      data: { cardTitle: input.title },
    });
  }
  if (input.isDone !== undefined && input.isDone !== card.isDone) {
    await logActivity({
      boardId,
      cardId,
      userId,
      type: input.isDone ? 'card.done' : 'card.undone',
    });
    if (input.isDone) {
      await notify({
        recipients: await recipients(),
        actorId: userId,
        type: 'card.marked.done',
        boardId,
        cardId,
        data: { cardTitle: card.title },
      });
    }
  }
  if (input.dueDate !== undefined) {
    await logActivity({
      boardId,
      cardId,
      userId,
      type: input.dueDate ? 'card.due.set' : 'card.due.clear',
      data: input.dueDate ? { dueDate: input.dueDate } : {},
    });
    if (input.dueDate) {
      await notify({
        recipients: await recipients(),
        actorId: userId,
        type: 'card.due.set',
        boardId,
        cardId,
        data: { cardTitle: card.title, dueDate: input.dueDate },
      });
    }
  }

  return updated;
}

export async function deleteCard(userId: string, cardId: string) {
  const card = await assertCardAccess(userId, cardId);
  const recipients = await cardMemberIds(cardId);
  await prisma.card.update({
    where: { id: cardId },
    data: { deletedAt: new Date() },
  });
  await notify({
    recipients,
    actorId: userId,
    type: 'card.deleted',
    boardId: card.list.boardId,
    data: { cardTitle: card.title },
  });
}

/**
 * Keo tha the: chuyen sang danh sach `listId`, chen vao vi tri `position`.
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

  if (card.list.boardId !== targetList.boardId) {
    throw new AppError('Khong the chuyen the sang bang khac', 400);
  }

  const sourceListId = card.listId;
  const sourceListName = card.list.name;

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

  if (sourceListId !== input.listId) {
    await logActivity({
      boardId: targetList.boardId,
      cardId,
      userId,
      type: 'card.move',
      data: { fromList: sourceListName, toList: targetList.name },
    });
    await notify({
      recipients: await cardMemberIds(cardId),
      actorId: userId,
      type: 'card.moved',
      boardId: targetList.boardId,
      cardId,
      data: { cardTitle: card.title, toList: targetList.name },
    });
  }

  return prisma.card.findFirst({ where: { id: cardId } });
}
