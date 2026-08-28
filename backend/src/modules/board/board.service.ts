import { prisma } from '../../config/prisma';
import {
  boardBackgroundPublicPath,
  removeBoardBackgroundFile,
} from '../../config/upload';
import { AppError } from '../../utils/AppError';
import type { CreateBoardInput, UpdateBoardInput } from './board.schema';

// Kiem tra nguoi dung la CHU bang. Dung cho: xoa bang, quan ly thanh vien.
export async function assertBoardOwner(userId: string, boardId: string) {
  const board = await prisma.board.findFirst({
    where: { id: boardId, deletedAt: null },
  });
  if (!board) {
    throw new AppError('Khong tim thay bang', 404);
  }
  if (board.ownerId !== userId) {
    throw new AppError('Chi chu bang moi thuc hien duoc thao tac nay', 403);
  }
  return board;
}

// Kiem tra nguoi dung CO QUYEN TRUY CAP bang: la chu HOAC la thanh vien.
// Dung cho: xem/sua bang, danh sach, the. Export de module list/card dung chung.
export async function assertBoardAccess(userId: string, boardId: string) {
  const board = await prisma.board.findFirst({
    where: { id: boardId, deletedAt: null },
  });
  if (!board) {
    throw new AppError('Khong tim thay bang', 404);
  }
  if (board.ownerId === userId) {
    return board;
  }
  const membership = await prisma.boardMember.findFirst({
    where: { boardId, userId, deletedAt: null },
  });
  if (!membership) {
    throw new AppError('Ban khong co quyen truy cap bang nay', 403);
  }
  return board;
}

export async function listMyBoards(userId: string) {
  const boards = await prisma.board.findMany({
    where: {
      deletedAt: null,
      members: { some: { userId, deletedAt: null } },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { members: { where: { deletedAt: null } } } },
    },
  });

  return boards.map(({ _count, ...board }) => ({
    ...board,
    memberCount: _count.members,
    isOwner: board.ownerId === userId,
  }));
}

export async function createBoard(userId: string, input: CreateBoardInput) {
  return prisma.board.create({
    data: {
      ownerId: userId,
      name: input.name,
      ...(input.color ? { color: input.color } : {}),
      members: { create: { userId, role: 'OWNER' } },
    },
  });
}

export async function updateBoard(
  userId: string,
  boardId: string,
  input: UpdateBoardInput
) {
  const board = await assertBoardAccess(userId, boardId);

  // Doi sang mau nen -> bo anh nen dang co (va xoa file cu tren dia)
  const switchingToColor =
    input.color !== undefined && board.backgroundImage !== null;

  const updated = await prisma.board.update({
    where: { id: boardId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(switchingToColor ? { backgroundImage: null } : {}),
    },
  });

  if (switchingToColor) {
    removeBoardBackgroundFile(board.backgroundImage);
  }

  return updated;
}

export async function setBoardBackground(
  userId: string,
  boardId: string,
  filename: string
) {
  const board = await assertBoardAccess(userId, boardId);

  const updated = await prisma.board.update({
    where: { id: boardId },
    data: { backgroundImage: boardBackgroundPublicPath(filename) },
  });

  // Xoa anh cu (neu truoc do da co) de khong ton dung luong
  removeBoardBackgroundFile(board.backgroundImage);

  return updated;
}

export async function clearBoardBackground(userId: string, boardId: string) {
  const board = await assertBoardAccess(userId, boardId);

  const updated = await prisma.board.update({
    where: { id: boardId },
    data: { backgroundImage: null },
  });

  removeBoardBackgroundFile(board.backgroundImage);

  return updated;
}

export async function deleteBoard(userId: string, boardId: string) {
  const board = await assertBoardOwner(userId, boardId);
  await prisma.board.update({
    where: { id: boardId },
    data: { deletedAt: new Date() },
  });
  removeBoardBackgroundFile(board.backgroundImage);
}
