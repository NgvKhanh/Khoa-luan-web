import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { logActivity } from '../activity/activity.service';
import { cardMemberIds, notify } from '../notification/notification.service';
import { assertCardAccess } from './card.service';

const USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
} as const;

// ---------- Thanh vien cua the ----------

export async function addCardMember(
  userId: string,
  cardId: string,
  targetUserId: string
) {
  const card = await assertCardAccess(userId, cardId);
  const boardId = card.list.boardId;

  // Nguoi duoc gan phai la thanh vien cua bang (hoac chu bang)
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  const isBoardMember =
    board?.ownerId === targetUserId ||
    (await prisma.boardMember.findFirst({
      where: { boardId, userId: targetUserId, deletedAt: null },
    })) !== null;
  if (!isBoardMember) {
    throw new AppError('Chi gan duoc thanh vien cua bang vao the', 400);
  }

  const member = await prisma.cardMember.upsert({
    where: { cardId_userId: { cardId, userId: targetUserId } },
    create: { cardId, userId: targetUserId },
    update: {},
    include: { user: { select: USER_SELECT } },
  });

  await logActivity({
    boardId,
    cardId,
    userId,
    type: 'member.add',
    data: { memberName: member.user.name },
  });
  await notify({
    recipients: [targetUserId],
    actorId: userId,
    type: 'card.member.added',
    boardId,
    cardId,
    data: { cardTitle: card.title },
  });

  return member;
}

export async function removeCardMember(
  userId: string,
  cardId: string,
  targetUserId: string
) {
  await assertCardAccess(userId, cardId);
  await prisma.cardMember.deleteMany({
    where: { cardId, userId: targetUserId },
  });
}

// ---------- Checklist ----------

async function checklistCard(userId: string, checklistId: string) {
  const checklist = await prisma.checklist.findUnique({
    where: { id: checklistId },
  });
  if (!checklist) throw new AppError('Khong tim thay checklist', 404);
  const card = await assertCardAccess(userId, checklist.cardId);
  return { checklist, boardId: card.list.boardId };
}

export async function addChecklist(
  userId: string,
  cardId: string,
  title: string,
  copyFromChecklistId?: string
) {
  await assertCardAccess(userId, cardId);
  const last = await prisma.checklist.findFirst({
    where: { cardId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  // Cac muc sao chep tu 1 checklist khac cua cung the (chi noi dung, bo tick)
  let copyItems: { content: string; position: number }[] = [];
  if (copyFromChecklistId) {
    const src = await prisma.checklist.findFirst({
      where: { id: copyFromChecklistId, cardId },
      include: {
        items: { orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] },
      },
    });
    if (src) {
      copyItems = src.items.map((it, i) => ({
        content: it.content,
        position: i,
      }));
    }
  }

  return prisma.checklist.create({
    data: {
      cardId,
      title: title.trim() || 'Việc cần làm',
      position: last ? last.position + 1 : 0,
      ...(copyItems.length > 0 ? { items: { create: copyItems } } : {}),
    },
    include: { items: { orderBy: [{ position: 'asc' }] } },
  });
}

export async function updateChecklist(
  userId: string,
  checklistId: string,
  title: string
) {
  await checklistCard(userId, checklistId);
  return prisma.checklist.update({
    where: { id: checklistId },
    data: { title: title.trim() || 'Việc cần làm' },
    include: { items: { orderBy: [{ position: 'asc' }] } },
  });
}

export async function deleteChecklist(userId: string, checklistId: string) {
  await checklistCard(userId, checklistId);
  await prisma.checklist.delete({ where: { id: checklistId } });
}

export async function addChecklistItem(
  userId: string,
  checklistId: string,
  content: string
) {
  await checklistCard(userId, checklistId);
  const last = await prisma.checklistItem.findFirst({
    where: { checklistId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  return prisma.checklistItem.create({
    data: {
      checklistId,
      content: content.trim(),
      position: last ? last.position + 1 : 0,
    },
  });
}

async function itemChecklist(userId: string, itemId: string) {
  const item = await prisma.checklistItem.findUnique({ where: { id: itemId } });
  if (!item) throw new AppError('Khong tim thay muc', 404);
  const { boardId } = await checklistCard(userId, item.checklistId);
  return { item, boardId };
}

async function assertBoardMemberUser(boardId: string, targetUserId: string) {
  const board = await prisma.board.findUnique({ where: { id: boardId } });
  const ok =
    board?.ownerId === targetUserId ||
    (await prisma.boardMember.findFirst({
      where: { boardId, userId: targetUserId, deletedAt: null },
    })) !== null;
  if (!ok) {
    throw new AppError('Chi chi dinh duoc thanh vien cua bang', 400);
  }
}

export async function updateChecklistItem(
  userId: string,
  itemId: string,
  input: {
    content?: string;
    isDone?: boolean;
    assigneeId?: string | null;
    dueDate?: string | null;
  }
) {
  const { boardId } = await itemChecklist(userId, itemId);

  if (typeof input.assigneeId === 'string') {
    await assertBoardMemberUser(boardId, input.assigneeId);
  }

  return prisma.checklistItem.update({
    where: { id: itemId },
    data: {
      ...(input.content !== undefined
        ? { content: input.content.trim() }
        : {}),
      ...(input.isDone !== undefined ? { isDone: input.isDone } : {}),
      ...(input.assigneeId !== undefined
        ? { assigneeId: input.assigneeId }
        : {}),
      ...(input.dueDate !== undefined
        ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
        : {}),
    },
    include: {
      assignee: { select: { id: true, name: true, avatarUrl: true } },
    },
  });
}

export async function deleteChecklistItem(userId: string, itemId: string) {
  await itemChecklist(userId, itemId);
  await prisma.checklistItem.delete({ where: { id: itemId } });
}

// ---------- Binh luan ----------

export async function addComment(
  userId: string,
  cardId: string,
  text: string
) {
  const card = await assertCardAccess(userId, cardId);
  const comment = await prisma.comment.create({
    data: { cardId, userId, text: text.trim() },
    include: { user: { select: USER_SELECT } },
  });

  await logActivity({
    boardId: card.list.boardId,
    cardId,
    userId,
    type: 'comment.create',
    data: { text: text.trim().slice(0, 120) },
  });
  await notify({
    recipients: await cardMemberIds(cardId),
    actorId: userId,
    type: 'card.comment',
    boardId: card.list.boardId,
    cardId,
    data: { cardTitle: card.title, text: text.trim().slice(0, 120) },
  });

  return comment;
}

async function ownComment(userId: string, commentId: string) {
  const comment = await prisma.comment.findFirst({
    where: { id: commentId, deletedAt: null },
  });
  if (!comment) throw new AppError('Khong tim thay binh luan', 404);
  await assertCardAccess(userId, comment.cardId);
  if (comment.userId !== userId) {
    throw new AppError('Chi tac gia moi sua/xoa duoc binh luan', 403);
  }
  return comment;
}

export async function updateComment(
  userId: string,
  commentId: string,
  text: string
) {
  await ownComment(userId, commentId);
  return prisma.comment.update({
    where: { id: commentId },
    data: { text: text.trim() },
    include: { user: { select: USER_SELECT } },
  });
}

export async function deleteComment(userId: string, commentId: string) {
  await ownComment(userId, commentId);
  await prisma.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
}
