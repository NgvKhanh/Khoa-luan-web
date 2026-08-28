import { prisma } from '../../config/prisma';
import {
  boardBackgroundPublicPath,
  removeBoardBackgroundFile,
} from '../../config/upload';
import { AppError } from '../../utils/AppError';
import type { CreateBoardInput, UpdateBoardInput } from './board.schema';

// Lay 1 bang con hoat dong va kiem tra dung chu so huu
async function getOwnBoardOrThrow(userId: string, boardId: string) {
  const board = await prisma.board.findFirst({
    where: { id: boardId, deletedAt: null },
  });
  if (!board) {
    throw new AppError('Khong tim thay bang', 404);
  }
  if (board.ownerId !== userId) {
    throw new AppError('Ban khong co quyen voi bang nay', 403);
  }
  return board;
}

export async function listMyBoards(userId: string) {
  return prisma.board.findMany({
    where: { ownerId: userId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createBoard(userId: string, input: CreateBoardInput) {
  return prisma.board.create({
    data: {
      ownerId: userId,
      name: input.name,
      ...(input.color ? { color: input.color } : {}),
    },
  });
}

export async function updateBoard(
  userId: string,
  boardId: string,
  input: UpdateBoardInput
) {
  const board = await getOwnBoardOrThrow(userId, boardId);

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
  const board = await getOwnBoardOrThrow(userId, boardId);

  const updated = await prisma.board.update({
    where: { id: boardId },
    data: { backgroundImage: boardBackgroundPublicPath(filename) },
  });

  // Xoa anh cu (neu truoc do da co) de khong ton dung luong
  removeBoardBackgroundFile(board.backgroundImage);

  return updated;
}

export async function clearBoardBackground(userId: string, boardId: string) {
  const board = await getOwnBoardOrThrow(userId, boardId);

  const updated = await prisma.board.update({
    where: { id: boardId },
    data: { backgroundImage: null },
  });

  removeBoardBackgroundFile(board.backgroundImage);

  return updated;
}

export async function deleteBoard(userId: string, boardId: string) {
  const board = await getOwnBoardOrThrow(userId, boardId);
  await prisma.board.update({
    where: { id: boardId },
    data: { deletedAt: new Date() },
  });
  removeBoardBackgroundFile(board.backgroundImage);
}
