import { prisma } from '../../config/prisma';
import { emitToBoard } from '../../realtime/socket';

type ActivityType =
  | 'card.create'
  | 'card.move'
  | 'card.rename'
  | 'card.done'
  | 'card.undone'
  | 'card.due.set'
  | 'card.due.clear'
  | 'card.archive'
  | 'card.restore'
  | 'comment.create'
  | 'member.add'
  | 'member.remove'
  | 'checklist.add'
  | 'attachment.add';

interface LogInput {
  boardId: string;
  cardId?: string | null;
  userId: string;
  type: ActivityType;
  data?: Record<string, unknown>;
}

// Ghi 1 dong nhat ky. Loi ghi log khong lam hong thao tac chinh.
export async function logActivity(input: LogInput): Promise<void> {
  try {
    await prisma.activity.create({
      data: {
        boardId: input.boardId,
        cardId: input.cardId ?? null,
        userId: input.userId,
        type: input.type,
        data: (input.data ?? {}) as object,
      },
    });
  } catch {
    // bo qua
  }
  // Moi thao tac co ghi nhat ky deu keo theo thay doi tren bang -> bao realtime
  emitToBoard(input.boardId, 'board:lists-changed');
}

const ACTIVITY_USER_SELECT = { id: true, name: true, avatarUrl: true } as const;

export async function listCardActivity(cardId: string) {
  return prisma.activity.findMany({
    where: { cardId },
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: { user: { select: ACTIVITY_USER_SELECT } },
  });
}

// Nhat ky thao tac cua ca 1 bang (moi nguoi, moi the)
export async function listBoardActivity(boardId: string) {
  return prisma.activity.findMany({
    where: { boardId },
    orderBy: { createdAt: 'desc' },
    take: 80,
    include: {
      user: { select: ACTIVITY_USER_SELECT },
      card: { select: { id: true, title: true } },
    },
  });
}

// Nhat ky thao tac cua chinh nguoi dung tren moi bang
export async function listMyActivity(userId: string) {
  return prisma.activity.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 60,
    include: {
      board: { select: { id: true, name: true } },
    },
  });
}
