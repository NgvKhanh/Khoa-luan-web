import { prisma } from '../../config/prisma';
import {
  cardAttachmentPublicPath,
  removeCardAttachmentFile,
} from '../../config/upload';
import { emitToBoard } from '../../realtime/socket';
import { AppError } from '../../utils/AppError';
import { logActivity } from '../activity/activity.service';
import { isBoardParticipant } from '../board/board.service';
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

  // Nguoi duoc gan phai co quyen o bang (thanh vien bang, hoac thanh vien
  // khong gian neu bang o muc WORKSPACE)
  if (!(await isBoardParticipant(boardId, targetUserId))) {
    throw new AppError('Chi gan duoc thanh vien cua bang vao the', 400);
  }

  const member = await prisma.cardMember.upsert({
    where: { cardId_userId: { cardId, userId: targetUserId } },
    create: { cardId, userId: targetUserId, assignedById: userId },
    update: {},
    include: { user: { select: USER_SELECT } },
  });

  await logActivity({
    boardId,
    cardId,
    userId,
    type: 'member.add',
    // memberId la bat buoc: chi co memberName thi hai nguoi trung ten se lan
    // nhau, khong tai dung duoc lich su phan cong. memberName van giu de giao
    // dien hien duoc ten cu ke ca sau khi nguoi do doi ten hoac bi xoa.
    data: { memberId: targetUserId, memberName: member.user.name },
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
  const card = await assertCardAccess(userId, cardId);
  await prisma.cardMember.deleteMany({
    where: { cardId, userId: targetUserId },
  });
  emitToBoard(card.list.boardId, 'board:lists-changed');
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
  const card = await assertCardAccess(userId, cardId);
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

  const checklist = await prisma.checklist.create({
    data: {
      cardId,
      title: title.trim() || 'Việc cần làm',
      position: last ? last.position + 1 : 0,
      ...(copyItems.length > 0 ? { items: { create: copyItems } } : {}),
    },
    include: { items: { orderBy: [{ position: 'asc' }] } },
  });
  emitToBoard(card.list.boardId, 'board:lists-changed');
  return checklist;
}

export async function updateChecklist(
  userId: string,
  checklistId: string,
  title: string
) {
  const { boardId } = await checklistCard(userId, checklistId);
  const updated = await prisma.checklist.update({
    where: { id: checklistId },
    data: { title: title.trim() || 'Việc cần làm' },
    include: { items: { orderBy: [{ position: 'asc' }] } },
  });
  emitToBoard(boardId, 'board:lists-changed');
  return updated;
}

export async function deleteChecklist(userId: string, checklistId: string) {
  const { boardId } = await checklistCard(userId, checklistId);
  await prisma.checklist.delete({ where: { id: checklistId } });
  emitToBoard(boardId, 'board:lists-changed');
}

export async function addChecklistItem(
  userId: string,
  checklistId: string,
  content: string
) {
  const { boardId } = await checklistCard(userId, checklistId);
  const last = await prisma.checklistItem.findFirst({
    where: { checklistId },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const item = await prisma.checklistItem.create({
    data: {
      checklistId,
      content: content.trim(),
      position: last ? last.position + 1 : 0,
    },
  });
  emitToBoard(boardId, 'board:lists-changed');
  return item;
}

async function itemChecklist(userId: string, itemId: string) {
  const item = await prisma.checklistItem.findUnique({ where: { id: itemId } });
  if (!item) throw new AppError('Khong tim thay muc', 404);
  const { boardId } = await checklistCard(userId, item.checklistId);
  return { item, boardId };
}

async function assertBoardMemberUser(boardId: string, targetUserId: string) {
  if (!(await isBoardParticipant(boardId, targetUserId))) {
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

  const updated = await prisma.checklistItem.update({
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
  emitToBoard(boardId, 'board:lists-changed');
  return updated;
}

export async function deleteChecklistItem(userId: string, itemId: string) {
  const { boardId } = await itemChecklist(userId, itemId);
  await prisma.checklistItem.delete({ where: { id: itemId } });
  emitToBoard(boardId, 'board:lists-changed');
}

// Sap xep lai thu tu cac muc trong 1 checklist
export async function reorderChecklistItems(
  userId: string,
  checklistId: string,
  itemIds: string[]
) {
  const { boardId } = await checklistCard(userId, checklistId);
  const items = await prisma.checklistItem.findMany({
    where: { checklistId },
    select: { id: true },
  });
  const ids = new Set(items.map((i) => i.id));
  if (itemIds.length !== ids.size || itemIds.some((id) => !ids.has(id))) {
    throw new AppError('Danh sách mục không hợp lệ', 400);
  }
  await prisma.$transaction(
    itemIds.map((id, i) =>
      prisma.checklistItem.update({ where: { id }, data: { position: i } })
    )
  );
  emitToBoard(boardId, 'board:lists-changed');
}

// Chuyen 1 muc checklist thanh 1 the moi (trong cung danh sach voi the cha)
export async function convertItemToCard(userId: string, itemId: string) {
  const item = await prisma.checklistItem.findUnique({
    where: { id: itemId },
    include: { checklist: { select: { cardId: true } } },
  });
  if (!item) throw new AppError('Khong tim thay muc', 404);

  const card = await assertCardAccess(userId, item.checklist.cardId);

  const last = await prisma.card.findFirst({
    where: { listId: card.listId, deletedAt: null, archivedAt: null },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const created = await prisma.card.create({
    data: {
      listId: card.listId,
      title: item.content.slice(0, 500),
      position: last ? last.position + 1 : 0,
    },
  });

  await prisma.checklistItem.delete({ where: { id: itemId } });

  await logActivity({
    boardId: card.list.boardId,
    cardId: created.id,
    userId,
    type: 'card.create',
    data: { listName: card.list.name },
  });

  return created;
}

// ---------- Binh luan ----------

// Tim cac thanh vien bang duoc nhac ten (@Ten) trong noi dung binh luan.
async function mentionedUserIds(
  boardId: string,
  text: string
): Promise<string[]> {
  if (!text.includes('@')) return [];
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: {
      owner: { select: { id: true, name: true } },
      members: {
        where: { deletedAt: null },
        select: { user: { select: { id: true, name: true } } },
      },
    },
  });
  if (!board) return [];
  const people = [
    board.owner,
    ...board.members.map((m) => m.user),
  ];
  const haystack = text.toLowerCase();
  const ids = new Set<string>();
  for (const p of people) {
    if (p.name && haystack.includes(`@${p.name.toLowerCase()}`)) {
      ids.add(p.id);
    }
  }
  return [...ids];
}

export async function addComment(
  userId: string,
  cardId: string,
  text: string
) {
  const card = await assertCardAccess(userId, cardId);
  const trimmed = text.trim();
  const comment = await prisma.comment.create({
    data: { cardId, userId, text: trimmed },
    include: { user: { select: USER_SELECT } },
  });

  await logActivity({
    boardId: card.list.boardId,
    cardId,
    userId,
    type: 'comment.create',
    data: { text: trimmed.slice(0, 120) },
  });

  const mentioned = await mentionedUserIds(card.list.boardId, trimmed);
  const commenters = await cardMemberIds(cardId);
  // Nguoi duoc nhac ten -> thong bao rieng "card.mentioned"
  await notify({
    recipients: mentioned,
    actorId: userId,
    type: 'card.mentioned',
    boardId: card.list.boardId,
    cardId,
    data: { cardTitle: card.title, text: trimmed.slice(0, 120) },
  });
  // Thanh vien the (khong tinh nguoi da duoc nhac) -> thong bao "card.comment"
  await notify({
    recipients: commenters.filter((id) => !mentioned.includes(id)),
    actorId: userId,
    type: 'card.comment',
    boardId: card.list.boardId,
    cardId,
    data: { cardTitle: card.title, text: trimmed.slice(0, 120) },
  });

  // Realtime: ai dang mo bang / the nay -> tai lai ngay
  emitToBoard(card.list.boardId, 'board:lists-changed');

  return comment;
}

async function ownComment(userId: string, commentId: string) {
  const comment = await prisma.comment.findFirst({
    where: { id: commentId, deletedAt: null },
  });
  if (!comment) throw new AppError('Khong tim thay binh luan', 404);
  const card = await assertCardAccess(userId, comment.cardId);
  if (comment.userId !== userId) {
    throw new AppError('Chi tac gia moi sua/xoa duoc binh luan', 403);
  }
  return { comment, boardId: card.list.boardId };
}

export async function updateComment(
  userId: string,
  commentId: string,
  text: string
) {
  const { boardId } = await ownComment(userId, commentId);
  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { text: text.trim() },
    include: { user: { select: USER_SELECT } },
  });
  emitToBoard(boardId, 'board:lists-changed');
  return updated;
}

export async function deleteComment(userId: string, commentId: string) {
  const { boardId } = await ownComment(userId, commentId);
  await prisma.comment.update({
    where: { id: commentId },
    data: { deletedAt: new Date() },
  });
  emitToBoard(boardId, 'board:lists-changed');
}

// ---------- Tep dinh kem ----------

export async function addAttachment(
  userId: string,
  cardId: string,
  file: Express.Multer.File
) {
  const card = await assertCardAccess(userId, cardId);
  // multer giai ma ten goc theo latin1 -> chuyen ve utf8 cho dung tieng Viet
  const name = Buffer.from(file.originalname, 'latin1')
    .toString('utf8')
    .slice(0, 200);

  const attachment = await prisma.attachment.create({
    data: {
      cardId,
      uploaderId: userId,
      name,
      url: cardAttachmentPublicPath(file.filename),
      mime: file.mimetype,
      size: file.size,
    },
    include: {
      uploader: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  await logActivity({
    boardId: card.list.boardId,
    cardId,
    userId,
    type: 'attachment.add',
    data: { name },
  });
  await notify({
    recipients: await cardMemberIds(cardId),
    actorId: userId,
    type: 'card.attachment.added',
    boardId: card.list.boardId,
    cardId,
    data: { cardTitle: card.title, name },
  });

  return attachment;
}

export async function deleteAttachment(userId: string, attachmentId: string) {
  const att = await prisma.attachment.findUnique({
    where: { id: attachmentId },
  });
  if (!att) throw new AppError('Khong tim thay tep dinh kem', 404);
  const card = await assertCardAccess(userId, att.cardId);

  await prisma.attachment.delete({ where: { id: attachmentId } });
  removeCardAttachmentFile(att.url);
  // Neu tep nay dang lam anh bia -> bo anh bia
  await prisma.card.updateMany({
    where: { id: att.cardId, coverImageUrl: att.url },
    data: { coverImageUrl: null },
  });
  emitToBoard(card.list.boardId, 'board:lists-changed');
}
