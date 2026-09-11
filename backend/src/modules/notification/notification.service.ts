import { prisma } from '../../config/prisma';
import { emitToBoard, emitToUser } from '../../realtime/socket';
import { watcherIdsForCard } from '../watch/watch.service';

export type NotificationType =
  | 'board.member.added'
  | 'board.member.removed'
  | 'board.role.changed'
  | 'board.ownership.transferred'
  | 'board.join.request'
  | 'board.join.approved'
  | 'board.join.rejected'
  | 'workspace.member.added'
  | 'workspace.member.removed'
  | 'workspace.role.changed'
  | 'workspace.ownership.transferred'
  | 'card.member.added'
  | 'card.comment'
  | 'card.mentioned'
  | 'card.attachment.added'
  | 'card.moved'
  | 'card.renamed'
  | 'card.due.set'
  | 'card.due.reminder'
  | 'card.marked.done'
  | 'card.deleted';

interface NotifyInput {
  recipients: string[]; // userId cua nguoi nhan
  actorId: string;
  type: NotificationType;
  boardId?: string | null;
  cardId?: string | null;
  workspaceId?: string | null;
  data?: Record<string, unknown>;
}

// Tao thong bao cho nhieu nguoi. Bo qua nguoi trung voi actor va trung lap.
// Loi ghi thong bao khong duoc lam hong thao tac chinh.
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const ids = [...new Set(input.recipients)].filter(
      (id) => id && id !== input.actorId
    );
    if (ids.length === 0) return;

    await prisma.notification.createMany({
      data: ids.map((userId) => ({
        userId,
        actorId: input.actorId,
        type: input.type,
        boardId: input.boardId ?? null,
        cardId: input.cardId ?? null,
        workspaceId: input.workspaceId ?? null,
        data: (input.data ?? {}) as object,
      })),
    });

    // Bao realtime cho tung nguoi nhan: co thong bao moi
    for (const userId of ids) {
      emitToUser(userId, 'notification:new', {});
    }
    // Su kien lien quan thanh vien -> lam moi danh sach thanh vien tren bang
    if (input.boardId && input.type.startsWith('board.')) {
      emitToBoard(input.boardId, 'board:members-changed');
    }
  } catch {
    // bo qua
  }
}

// Thong bao nhac han: khong co "nguoi thuc hien" that (he thong tu tao), nen
// khong the dung notify() vi ham do loc bo nguoi nhan trung voi actorId.
// actorId o day dat = chinh userId nhan (chi de thoa man khoa ngoai bat buoc).
export async function notifyDueReminder(input: {
  userId: string;
  cardId: string;
  boardId: string;
  data: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        actorId: input.userId,
        type: 'card.due.reminder',
        boardId: input.boardId,
        cardId: input.cardId,
        data: input.data as object,
      },
    });
    emitToUser(input.userId, 'notification:new', {});
  } catch {
    // bo qua
  }
}

// Tien ich: userId cac thanh vien the + nguoi dang THEO DOI the / danh sach /
// bang chua no, CON quyen truy cap bang. Loc bo nguoi da bi thu hoi quyen
// (vd bi xoa khoi bang, roi khoi khong gian) de ho khong con nhan thong bao
// chua ten the / noi dung binh luan moi.
export async function cardMemberIds(cardId: string): Promise<string[]> {
  const card = await prisma.card.findUnique({
    where: { id: cardId },
    select: {
      listId: true,
      members: { select: { userId: true } },
      list: {
        select: {
          board: {
            select: {
              id: true,
              ownerId: true,
              visibility: true,
              workspaceId: true,
            },
          },
        },
      },
    },
  });
  if (!card) return [];

  const board = card.list.board;
  const watcherIds = await watcherIdsForCard(cardId, card.listId, board.id);
  const candidateIds = [
    ...new Set([...card.members.map((m) => m.userId), ...watcherIds]),
  ];
  if (candidateIds.length === 0) return [];
  const activeMembers = await prisma.boardMember.findMany({
    where: {
      boardId: board.id,
      deletedAt: null,
      userId: { in: candidateIds },
    },
    select: { userId: true },
  });
  const allowed = new Set<string>([
    board.ownerId,
    ...activeMembers.map((m) => m.userId),
  ]);

  if (board.visibility === 'WORKSPACE') {
    const wsMembers = await prisma.workspaceMember.findMany({
      where: {
        workspaceId: board.workspaceId,
        deletedAt: null,
        userId: { in: candidateIds },
      },
      select: { userId: true },
    });
    for (const m of wsMembers) allowed.add(m.userId);
  }
  // Bang PUBLIC: ai cung xem duoc -> nguoi theo doi (du chua la thanh vien)
  // van hop le, khong bi loc bo.
  if (board.visibility === 'PUBLIC') {
    for (const id of candidateIds) allowed.add(id);
  }

  return candidateIds.filter((id) => allowed.has(id));
}

// Tien ich: chu bang + cac quan tri vien cua 1 bang
export async function boardManagerIds(boardId: string): Promise<string[]> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true },
  });
  const admins = await prisma.boardMember.findMany({
    where: { boardId, deletedAt: null, role: { in: ['OWNER', 'ADMIN'] } },
    select: { userId: true },
  });
  return [
    ...(board ? [board.ownerId] : []),
    ...admins.map((a) => a.userId),
  ];
}

const ACTOR_SELECT = { id: true, name: true, avatarUrl: true } as const;

export async function listNotifications(
  userId: string,
  opts: { unreadOnly?: boolean }
) {
  return prisma.notification.findMany({
    where: { userId, ...(opts.unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 40,
    include: { actor: { select: ACTOR_SELECT } },
  });
}

export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markRead(userId: string, id: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { id, userId },
    data: { isRead: true },
  });
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
}
