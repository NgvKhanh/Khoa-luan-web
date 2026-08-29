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

// Kiem tra nguoi dung CO QUYEN QUAN LY thanh vien: chu bang HOAC Quan tri vien (ADMIN).
// Dung cho: moi/xoa thanh vien, doi vai tro, link moi, duyet yeu cau tham gia.
export async function assertBoardManage(userId: string, boardId: string) {
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
  if (!membership || membership.role === 'MEMBER') {
    throw new AppError('Chi Quan tri vien moi thuc hien duoc thao tac nay', 403);
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
      members: {
        where: { userId, deletedAt: null },
        select: { starred: true },
      },
    },
  });

  return boards.map(({ _count, members, ...board }) => ({
    ...board,
    memberCount: _count.members,
    isOwner: board.ownerId === userId,
    isStarred: members[0]?.starred ?? false,
  }));
}

// Danh dau / bo danh dau sao bang cho nguoi dung hien tai
export async function setBoardStar(
  userId: string,
  boardId: string,
  starred: boolean
) {
  await assertBoardAccess(userId, boardId);
  await prisma.boardMember.updateMany({
    where: { boardId, userId, deletedAt: null },
    data: { starred },
  });
}

export async function createBoard(userId: string, input: CreateBoardInput) {
  return prisma.board.create({
    data: {
      ownerId: userId,
      name: input.name,
      ...(input.color ? { color: input.color } : {}),
      ...(input.backgroundImage
        ? { backgroundImage: input.backgroundImage }
        : {}),
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

  const data: {
    name?: string;
    color?: string;
    backgroundImage?: string | null;
  } = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.color !== undefined) data.color = input.color;

  // Anh nen theo thu tu uu tien:
  //  - backgroundImage la chuoi  -> dat anh moi
  //  - backgroundImage === null  -> bo anh nen
  //  - chi doi mau               -> bo anh nen dang co (quay ve mau)
  let oldFileToRemove: string | null = null;
  if (typeof input.backgroundImage === 'string') {
    data.backgroundImage = input.backgroundImage;
    oldFileToRemove = board.backgroundImage;
  } else if (input.backgroundImage === null) {
    data.backgroundImage = null;
    oldFileToRemove = board.backgroundImage;
  } else if (input.color !== undefined && board.backgroundImage !== null) {
    data.backgroundImage = null;
    oldFileToRemove = board.backgroundImage;
  }

  const updated = await prisma.board.update({ where: { id: boardId }, data });

  if (oldFileToRemove) {
    removeBoardBackgroundFile(oldFileToRemove);
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
