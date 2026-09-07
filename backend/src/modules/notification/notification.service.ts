import { prisma } from '../../config/prisma';

export type NotificationType =
  | 'board.member.added'
  | 'board.member.removed'
  | 'board.role.changed'
  | 'board.join.request'
  | 'board.join.approved'
  | 'board.join.rejected'
  | 'card.member.added'
  | 'card.comment'
  | 'card.mentioned'
  | 'card.attachment.added'
  | 'card.moved'
  | 'card.renamed'
  | 'card.due.set'
  | 'card.marked.done'
  | 'card.deleted';

interface NotifyInput {
  recipients: string[]; // userId cua nguoi nhan
  actorId: string;
  type: NotificationType;
  boardId?: string | null;
  cardId?: string | null;
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
        data: (input.data ?? {}) as object,
      })),
    });
  } catch {
    // bo qua
  }
}

// Tien ich: lay userId cac thanh vien cua 1 the
export async function cardMemberIds(cardId: string): Promise<string[]> {
  const rows = await prisma.cardMember.findMany({
    where: { cardId },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
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
