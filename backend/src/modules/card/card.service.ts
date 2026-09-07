import { prisma } from '../../config/prisma';
import { emitToBoard } from '../../realtime/socket';
import { AppError } from '../../utils/AppError';
import { logActivity } from '../activity/activity.service';
import { assertBoardAccess, assertBoardView } from '../board/board.service';
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

// Sao chep 1 the (kem nhan, thanh vien, checklist + muc) sang cung/khac danh sach cung bang
export async function copyCard(
  userId: string,
  cardId: string,
  input: { title?: string; listId?: string }
) {
  const src = await assertCardAccess(userId, cardId);
  const boardId = src.list.boardId;
  const targetListId = input.listId ?? src.listId;

  if (targetListId !== src.listId) {
    const tl = await prisma.list.findFirst({
      where: { id: targetListId, deletedAt: null, archivedAt: null },
    });
    if (!tl || tl.boardId !== boardId) {
      throw new AppError('Danh sach dich khong hop le', 400);
    }
  }

  const full = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      labels: true,
      members: true,
      checklists: { include: { items: true } },
    },
  });

  const last = await prisma.card.findFirst({
    where: { listId: targetListId, deletedAt: null, archivedAt: null },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  const created = await prisma.card.create({
    data: {
      listId: targetListId,
      title: (input.title?.trim() || `${src.title} (bản sao)`).slice(0, 500),
      description: src.description,
      startDate: src.startDate,
      dueDate: src.dueDate,
      coverColor: src.coverColor,
      coverImageUrl: src.coverImageUrl,
      position: last ? last.position + 1 : 0,
      ...(full && full.labels.length > 0
        ? { labels: { create: full.labels.map((l) => ({ labelId: l.labelId })) } }
        : {}),
      ...(full && full.members.length > 0
        ? { members: { create: full.members.map((m) => ({ userId: m.userId })) } }
        : {}),
      ...(full && full.checklists.length > 0
        ? {
            checklists: {
              create: full.checklists.map((cl) => ({
                title: cl.title,
                position: cl.position,
                items: {
                  create: cl.items.map((it) => ({
                    content: it.content,
                    isDone: it.isDone,
                    position: it.position,
                    assigneeId: it.assigneeId,
                    dueDate: it.dueDate,
                  })),
                },
              })),
            },
          }
        : {}),
    },
  });

  await logActivity({
    boardId,
    cardId: created.id,
    userId,
    type: 'card.create',
    data: { listName: src.list.name },
  });

  return created;
}

// Lay 1 the con hoat dong + kiem tra quyen. Tra ve card kem boardId (de ghi log).
export async function assertCardAccess(userId: string, cardId: string) {
  const card = await prisma.card.findFirst({
    where: { id: cardId, deletedAt: null, archivedAt: null },
    include: { list: { select: { boardId: true, name: true } } },
  });
  if (!card) {
    throw new AppError('Khong tim thay the', 404);
  }
  await assertListAccess(userId, card.listId);
  return card;
}

// Tat ca cac the ma nguoi dung duoc gan lam thanh vien, tren moi bang
export async function listMyCards(userId: string) {
  return prisma.card.findMany({
    where: {
      deletedAt: null,
      archivedAt: null,
      members: { some: { userId } },
      list: {
        deletedAt: null,
        archivedAt: null,
        board: { deletedAt: null },
      },
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      isDone: true,
      startDate: true,
      dueDate: true,
      coverColor: true,
      list: {
        select: {
          id: true,
          name: true,
          boardId: true,
          board: { select: { id: true, name: true } },
        },
      },
      labels: { include: { label: true } },
    },
  });
}

// Cac the co ngay het han trong khoang [from, to], tren cac bang minh la thanh vien
export async function listCalendarCards(
  userId: string,
  from: Date,
  to: Date
) {
  return prisma.card.findMany({
    where: {
      deletedAt: null,
      archivedAt: null,
      dueDate: { gte: from, lte: to },
      list: {
        deletedAt: null,
        archivedAt: null,
        board: {
          deletedAt: null,
          members: { some: { userId, deletedAt: null } },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
    select: {
      id: true,
      title: true,
      isDone: true,
      startDate: true,
      dueDate: true,
      list: {
        select: {
          id: true,
          name: true,
          boardId: true,
          board: { select: { id: true, name: true, color: true } },
        },
      },
    },
  });
}

export async function getCardDetail(userId: string, cardId: string) {
  const found = await prisma.card.findFirst({
    where: { id: cardId, deletedAt: null, archivedAt: null },
    include: { list: { select: { boardId: true } } },
  });
  if (!found) throw new AppError('Khong tim thay the', 404);
  await assertBoardView(userId, found.list.boardId);

  const card = await prisma.card.findFirst({
    where: { id: cardId, deletedAt: null, archivedAt: null },
    include: {
      list: { select: { id: true, name: true, boardId: true } },
      members: { include: { user: { select: CARD_USER_SELECT } } },
      labels: { include: { label: true } },
      checklists: {
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        include: {
          items: {
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
            include: {
              assignee: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
      },
      comments: {
        where: { deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { user: { select: CARD_USER_SELECT } },
      },
      attachments: {
        orderBy: { createdAt: 'desc' },
        include: {
          uploader: { select: { id: true, name: true, avatarUrl: true } },
        },
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
    where: { listId, deletedAt: null, archivedAt: null },
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
      ...(input.startDate !== undefined
        ? { startDate: input.startDate ? new Date(input.startDate) : null }
        : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
        : {}),
      ...(input.coverColor !== undefined
        ? { coverColor: input.coverColor }
        : {}),
      ...(input.coverImageUrl !== undefined
        ? { coverImageUrl: input.coverImageUrl || null }
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

  emitToBoard(boardId, 'board:lists-changed');
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

// Lay the (bat ke da luu tru) + kiem tra quyen sua bang chua no.
async function assertArchivedCard(userId: string, cardId: string) {
  const card = await prisma.card.findFirst({
    where: { id: cardId, deletedAt: null },
    include: { list: { select: { boardId: true } } },
  });
  if (!card) throw new AppError('Khong tim thay the', 404);
  await assertBoardAccess(userId, card.list.boardId);
  return card;
}

// Luu tru the (co the khoi phuc)
export async function archiveCard(userId: string, cardId: string) {
  const card = await assertCardAccess(userId, cardId);
  await prisma.card.update({
    where: { id: cardId },
    data: { archivedAt: new Date() },
  });
  await logActivity({
    boardId: card.list.boardId,
    cardId,
    userId,
    type: 'card.archive',
  });
}

// Khoi phuc the da luu tru -> dua ve cuoi danh sach
export async function restoreCard(userId: string, cardId: string) {
  const card = await assertArchivedCard(userId, cardId);
  const last = await prisma.card.findFirst({
    where: { listId: card.listId, deletedAt: null, archivedAt: null },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  await prisma.card.update({
    where: { id: cardId },
    data: { archivedAt: null, position: last ? last.position + 1 : 0 },
  });
  await logActivity({
    boardId: card.list.boardId,
    cardId,
    userId,
    type: 'card.restore',
  });
}

// Xoa han the da luu tru
export async function purgeCard(userId: string, cardId: string) {
  const card = await assertArchivedCard(userId, cardId);
  await prisma.card.update({
    where: { id: cardId },
    data: { deletedAt: new Date() },
  });
  emitToBoard(card.list.boardId, 'board:lists-changed');
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
    where: {
      listId: input.listId,
      deletedAt: null,
      archivedAt: null,
      id: { not: cardId },
    },
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
      where: {
        listId: sourceListId,
        deletedAt: null,
        archivedAt: null,
        id: { not: cardId },
      },
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

  // Ke ca keo trong cung danh sach (khong ghi log) van bao realtime
  emitToBoard(targetList.boardId, 'board:lists-changed');
  return prisma.card.findFirst({ where: { id: cardId } });
}
