import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { assertBoardAccess, assertBoardOwner } from './board.service';
import type { AddBoardMemberInput } from './boardMember.schema';

const MEMBER_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
} as const;

export async function listBoardMembers(userId: string, boardId: string) {
  await assertBoardAccess(userId, boardId);
  return prisma.boardMember.findMany({
    where: { boardId, deletedAt: null },
    orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
    include: { user: { select: MEMBER_USER_SELECT } },
  });
}

export async function addBoardMember(
  actorId: string,
  boardId: string,
  input: AddBoardMemberInput
) {
  await assertBoardOwner(actorId, boardId);

  const targetUser = await prisma.user.findFirst({
    where: { email: input.email, deletedAt: null },
    select: { id: true },
  });
  if (!targetUser) {
    throw new AppError('Khong tim thay nguoi dung voi email nay', 404);
  }

  const existing = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId: targetUser.id } },
  });
  if (existing && existing.deletedAt === null) {
    throw new AppError('Nguoi nay da la thanh vien cua bang', 409);
  }

  // Neu truoc do da bi xoa -> khoi phuc lai
  return existing
    ? prisma.boardMember.update({
        where: { id: existing.id },
        data: { deletedAt: null, role: 'MEMBER', joinedAt: new Date() },
        include: { user: { select: MEMBER_USER_SELECT } },
      })
    : prisma.boardMember.create({
        data: { boardId, userId: targetUser.id, role: 'MEMBER' },
        include: { user: { select: MEMBER_USER_SELECT } },
      });
}

export async function removeBoardMember(
  actorId: string,
  boardId: string,
  targetUserId: string
) {
  await assertBoardOwner(actorId, boardId);

  const membership = await prisma.boardMember.findFirst({
    where: { boardId, userId: targetUserId, deletedAt: null },
  });
  if (!membership) {
    throw new AppError('Nguoi nay khong phai thanh vien cua bang', 404);
  }
  if (membership.role === 'OWNER') {
    throw new AppError('Khong the xoa chu bang khoi bang', 400);
  }

  await prisma.boardMember.update({
    where: { id: membership.id },
    data: { deletedAt: new Date() },
  });
}
