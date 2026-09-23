import { prisma } from '../../config/prisma';
import {
  boardBackgroundPublicPath,
  removeBoardBackgroundFile,
} from '../../config/upload';
import {
  emitToBoard,
  emitToUser,
  reconcileBoardRoomAccess,
} from '../../realtime/socket';
import { AppError } from '../../utils/AppError';
import {
  assertWorkspaceAccess,
  memberWorkspaceIds,
  workspaceRoleOf,
} from '../workspace/workspace.service';
import type { CreateBoardInput, UpdateBoardInput } from './board.schema';
import { getTemplate } from './boardTemplates';
import { isWatchingBoard } from '../watch/watch.service';

// Kiem tra nguoi dung la CHU bang. Dung cho: xoa bang, luu tru, chuyen chu bang.
export async function assertBoardOwner(userId: string, boardId: string) {
  const board = await prisma.board.findFirst({
    where: { id: boardId, deletedAt: null, archivedAt: null },
  });
  if (!board) {
    throw new AppError('Khong tim thay bang', 404);
  }
  if (board.ownerId !== userId) {
    throw new AppError('Chi chu bang moi thuc hien duoc thao tac nay', 403);
  }
  return board;
}

// CO QUYEN SUA bang: chu bang / thanh vien bang (tru vai tro VIEWER - chi xem) /
// (bang WORKSPACE + la thanh vien cua khong gian chua bang). Dung cho: sua
// bang, danh sach, the.
export async function assertBoardAccess(userId: string, boardId: string) {
  const board = await prisma.board.findFirst({
    where: { id: boardId, deletedAt: null, archivedAt: null },
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
  if (membership && membership.role !== 'VIEWER') {
    return board;
  }
  if (
    !membership &&
    board.visibility === 'WORKSPACE' &&
    (await workspaceRoleOf(userId, board.workspaceId)) !== null
  ) {
    return board;
  }
  throw new AppError('Ban khong co quyen truy cap bang nay', 403);
}

// QUYEN XEM: chu bang / thanh vien bang / thanh vien khong gian (bang WORKSPACE)
// -> xem (+ sua neu khong phai VIEWER); bang PUBLIC -> ai cung xem (chi doc),
// KE CA KHACH CHUA DANG NHAP (userId = null) - dung cho lien ket cong khai.
// Tra ve { board, canEdit }.
export async function assertBoardView(
  userId: string | null,
  boardId: string
) {
  const board = await prisma.board.findFirst({
    where: { id: boardId, deletedAt: null, archivedAt: null },
  });
  if (!board) {
    throw new AppError('Khong tim thay bang', 404);
  }
  if (userId) {
    if (board.ownerId === userId) {
      return { board, canEdit: true };
    }
    const membership = await prisma.boardMember.findFirst({
      where: { boardId, userId, deletedAt: null },
    });
    if (membership) {
      return { board, canEdit: membership.role !== 'VIEWER' };
    }
    if (
      board.visibility === 'WORKSPACE' &&
      (await workspaceRoleOf(userId, board.workspaceId)) !== null
    ) {
      return { board, canEdit: true };
    }
  }
  if (board.visibility === 'PUBLIC') {
    return { board, canEdit: false };
  }
  throw new AppError('Ban khong co quyen truy cap bang nay', 403);
}

// Lay chi tiet 1 bang (kem ten khong gian).
export async function getBoard(userId: string, boardId: string) {
  const { board, canEdit } = await assertBoardView(userId, boardId);
  const workspace = await prisma.workspace.findUnique({
    where: { id: board.workspaceId },
    select: { name: true, isPersonal: true },
  });
  // inviteToken KHONG duoc lo qua duong doc nay: chi endpoint /invite-link (yeu cau
  // quyen quan ly) moi duoc tra ma moi thuc su.
  const { inviteToken: _inviteToken, ...safeBoard } = board;
  return {
    ...safeBoard,
    workspaceName: workspace?.name ?? '',
    workspaceIsPersonal: workspace?.isPersonal ?? false,
    isOwner: board.ownerId === userId,
    canEdit,
    // Quyen quan ly tinh o backend (tinh ca OWNER/ADMIN cua khong gian) de
    // frontend khong phai suy doan lai va bo sot truong hop.
    canManage: await canManageBoard(userId, board),
    isWatching: await isWatchingBoard(userId, boardId),
  };
}

// Predicate (khong nem loi): nguoi dung co QUYEN QUAN LY bang khong?
// chu bang / Quan tri vien bang / chu hoac ADMIN cua khong gian chua bang.
export async function canManageBoard(
  userId: string,
  board: { id: string; ownerId: string; workspaceId: string }
): Promise<boolean> {
  if (board.ownerId === userId) return true;
  const membership = await prisma.boardMember.findFirst({
    where: { boardId: board.id, userId, deletedAt: null },
    select: { role: true },
  });
  if (
    membership &&
    (membership.role === 'ADMIN' || membership.role === 'OWNER')
  )
    return true;
  const wsRole = await workspaceRoleOf(userId, board.workspaceId);
  return wsRole === 'OWNER' || wsRole === 'ADMIN';
}

// CO QUYEN QUAN LY bang: chu bang / Quan tri vien bang / chu hoac ADMIN cua
// khong gian chua bang. Dung cho: moi-xoa thanh vien, link moi, doi hien thi.
export async function assertBoardManage(userId: string, boardId: string) {
  const board = await prisma.board.findFirst({
    where: { id: boardId, deletedAt: null, archivedAt: null },
  });
  if (!board) {
    throw new AppError('Khong tim thay bang', 404);
  }
  if (await canManageBoard(userId, board)) {
    return board;
  }
  throw new AppError('Chi Quan tri vien moi thuc hien duoc thao tac nay', 403);
}

// Nguoi dung co "thuoc ve" bang khong (de gan lam thanh vien the / nguoi phu trach):
// chu bang, thanh vien bang, hoac thanh vien khong gian neu bang o muc WORKSPACE.
export async function isBoardParticipant(
  boardId: string,
  userId: string
): Promise<boolean> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    select: { ownerId: true, visibility: true, workspaceId: true },
  });
  if (!board) return false;
  if (board.ownerId === userId) return true;
  // VIEWER chi xem - khong duoc gan lam thanh vien the / nguoi phu trach
  const bm = await prisma.boardMember.findFirst({
    where: { boardId, userId, deletedAt: null, role: { not: 'VIEWER' } },
    select: { id: true },
  });
  if (bm) return true;
  if (board.visibility === 'WORKSPACE') {
    return (await workspaceRoleOf(userId, board.workspaceId)) !== null;
  }
  return false;
}

export async function listMyBoards(userId: string) {
  const myWorkspaceIds = await memberWorkspaceIds(userId);
  const boards = await prisma.board.findMany({
    where: {
      deletedAt: null,
      archivedAt: null,
      OR: [
        { members: { some: { userId, deletedAt: null } } },
        { visibility: 'WORKSPACE', workspaceId: { in: myWorkspaceIds } },
      ],
    },
    orderBy: { createdAt: 'desc' },
    include: {
      workspace: { select: { name: true, isPersonal: true } },
      _count: { select: { members: { where: { deletedAt: null } } } },
      members: {
        where: { userId, deletedAt: null },
        select: { id: true },
      },
      stars: { where: { userId }, select: { userId: true } },
    },
  });

  return boards.map(({ _count, members, stars, workspace, ...board }) => ({
    ...board,
    workspaceName: workspace.name,
    workspaceIsPersonal: workspace.isPersonal,
    memberCount: _count.members,
    isOwner: board.ownerId === userId,
    isMember: members.length > 0,
    isStarred: stars.length > 0,
  }));
}

// Danh dau / bo danh dau sao bang cho nguoi dung hien tai.
// Luu vao bang BoardStar rieng -> nguoi truy cap qua "khong gian lam viec"
// (chua la thanh vien truc tiep cua bang) van luu duoc dau sao.
export async function setBoardStar(
  userId: string,
  boardId: string,
  starred: boolean
) {
  await assertBoardAccess(userId, boardId);
  if (starred) {
    await prisma.boardStar.upsert({
      where: { userId_boardId: { userId, boardId } },
      create: { userId, boardId },
      update: {},
    });
  } else {
    await prisma.boardStar.deleteMany({ where: { userId, boardId } });
  }
}

// Tao 1 bang tu mau co san (kem toan bo list + the mau)
export async function createBoardFromTemplate(
  userId: string,
  workspaceId: string,
  templateId: string,
  name?: string
) {
  await assertWorkspaceAccess(userId, workspaceId);
  const tpl = getTemplate(templateId);
  if (!tpl) {
    throw new AppError('Không tìm thấy mẫu này', 404);
  }
  return prisma.board.create({
    data: {
      ownerId: userId,
      workspaceId,
      name: name?.trim() || tpl.name,
      color: tpl.color,
      members: { create: { userId, role: 'OWNER' } },
      lists: {
        create: tpl.lists.map((l, li) => ({
          name: l.name,
          position: li,
          cards: {
            create: l.cards.map((title, ci) => ({ title, position: ci })),
          },
        })),
      },
    },
  });
}

export async function createBoard(userId: string, input: CreateBoardInput) {
  await assertWorkspaceAccess(userId, input.workspaceId);
  return prisma.board.create({
    data: {
      ownerId: userId,
      workspaceId: input.workspaceId,
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
  // Doi ten / mau / anh nen: chi can quyen SUA bang.
  // Doi che do hien thi (visibility): phai co quyen QUAN LY bang.
  const board =
    input.visibility !== undefined
      ? await assertBoardManage(userId, boardId)
      : await assertBoardAccess(userId, boardId);

  const data: {
    name?: string;
    color?: string;
    backgroundImage?: string | null;
    visibility?: 'PRIVATE' | 'WORKSPACE' | 'PUBLIC';
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

  if (input.visibility !== undefined) data.visibility = input.visibility;

  const updated = await prisma.board.update({ where: { id: boardId }, data });

  if (oldFileToRemove) {
    removeBoardBackgroundFile(oldFileToRemove);
  }

  emitToBoard(boardId, 'board:meta-changed');

  // Doi muc hien thi -> danh sach bang cua moi thanh vien khong gian co the doi
  if (input.visibility !== undefined && input.visibility !== board.visibility) {
    const wsMembers = await prisma.workspaceMember.findMany({
      where: { workspaceId: board.workspaceId, deletedAt: null },
      select: { userId: true },
    });
    for (const { userId: uid } of wsMembers) {
      emitToUser(uid, 'board:access-changed');
    }
    // Visibility thu hep lai (vd PUBLIC/WORKSPACE -> PRIVATE) co the khien
    // nguoi dang o trong "phong" Socket.IO cua bang nay mat quyen xem ngay
    // lap tuc -> don ho ra khoi phong, khong doi den khi ho tu ket noi lai.
    void reconcileBoardRoomAccess(boardId);
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

  emitToBoard(boardId, 'board:meta-changed');
  return updated;
}

export async function clearBoardBackground(userId: string, boardId: string) {
  const board = await assertBoardAccess(userId, boardId);

  const updated = await prisma.board.update({
    where: { id: boardId },
    data: { backgroundImage: null },
  });

  removeBoardBackgroundFile(board.backgroundImage);

  emitToBoard(boardId, 'board:meta-changed');
  return updated;
}

// Danh sach cac muc da luu tru cua 1 bang (the + danh sach)
export async function listBoardArchive(userId: string, boardId: string) {
  await assertBoardAccess(userId, boardId);

  const cards = await prisma.card.findMany({
    where: {
      deletedAt: null,
      archivedAt: { not: null },
      list: { boardId },
    },
    orderBy: { archivedAt: 'desc' },
    select: {
      id: true,
      title: true,
      archivedAt: true,
      list: { select: { id: true, name: true } },
    },
  });

  const lists = await prisma.list.findMany({
    where: { boardId, deletedAt: null, archivedAt: { not: null } },
    orderBy: { archivedAt: 'desc' },
    select: {
      id: true,
      name: true,
      archivedAt: true,
      _count: { select: { cards: { where: { deletedAt: null } } } },
    },
  });

  return {
    cards,
    lists: lists.map(({ _count, ...l }) => ({
      ...l,
      cardCount: _count.cards,
    })),
  };
}

// Xuat toan bo noi dung bang thanh 1 doi tuong JSON long nhau
export async function exportBoard(userId: string, boardId: string) {
  await assertBoardView(userId, boardId);

  const USER = { id: true, name: true, email: true } as const;
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      labels: { orderBy: { createdAt: 'asc' } },
      members: {
        where: { deletedAt: null },
        include: { user: { select: USER } },
      },
      lists: {
        where: { deletedAt: null, archivedAt: null },
        orderBy: { position: 'asc' },
        include: {
          cards: {
            where: { deletedAt: null, archivedAt: null },
            orderBy: { position: 'asc' },
            include: {
              labels: { include: { label: true } },
              members: { include: { user: { select: USER } } },
              checklists: {
                orderBy: { position: 'asc' },
                include: { items: { orderBy: { position: 'asc' } } },
              },
              comments: {
                where: { deletedAt: null },
                orderBy: { createdAt: 'asc' },
                include: { user: { select: USER } },
              },
              attachments: { orderBy: { createdAt: 'asc' } },
            },
          },
        },
      },
    },
  });
  if (!board) throw new AppError('Khong tim thay bang', 404);

  return { exportedAt: new Date().toISOString(), version: 1, board };
}

export async function deleteBoard(userId: string, boardId: string) {
  const board = await assertBoardOwner(userId, boardId);
  await prisma.board.update({
    where: { id: boardId },
    data: { deletedAt: new Date() },
  });
  removeBoardBackgroundFile(board.backgroundImage);
}

// ---- Luu tru / khoi phuc / xoa han CA BANG (chi chu bang) ----

// Lay bang bat ke da luu tru + kiem tra la chu bang
async function assertArchivedBoardOwner(userId: string, boardId: string) {
  const board = await prisma.board.findFirst({
    where: { id: boardId, deletedAt: null },
  });
  if (!board) throw new AppError('Khong tim thay bang', 404);
  if (board.ownerId !== userId) {
    throw new AppError('Chi chu bang moi thuc hien duoc thao tac nay', 403);
  }
  return board;
}

async function boardMemberIds(boardId: string): Promise<string[]> {
  const rows = await prisma.boardMember.findMany({
    where: { boardId, deletedAt: null },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

export async function archiveBoard(userId: string, boardId: string) {
  await assertBoardOwner(userId, boardId);
  const memberIds = await boardMemberIds(boardId);
  await prisma.board.update({
    where: { id: boardId },
    data: { archivedAt: new Date() },
  });
  // Ai dang mo bang nay -> day ve trang chu
  for (const id of memberIds) {
    emitToUser(id, 'board:removed', { boardId });
  }
}

export async function restoreBoard(userId: string, boardId: string) {
  await assertArchivedBoardOwner(userId, boardId);
  await prisma.board.update({
    where: { id: boardId },
    data: { archivedAt: null },
  });
}

export async function purgeBoard(userId: string, boardId: string) {
  const board = await assertArchivedBoardOwner(userId, boardId);
  await prisma.board.update({
    where: { id: boardId },
    data: { deletedAt: new Date() },
  });
  removeBoardBackgroundFile(board.backgroundImage);
}

// Danh sach cac bang da luu tru cua nguoi dung
export async function listArchivedBoards(userId: string) {
  const boards = await prisma.board.findMany({
    where: {
      deletedAt: null,
      archivedAt: { not: null },
      members: { some: { userId, deletedAt: null } },
    },
    orderBy: { archivedAt: 'desc' },
    select: {
      id: true,
      name: true,
      color: true,
      backgroundImage: true,
      ownerId: true,
      archivedAt: true,
    },
  });
  return boards.map((b) => ({ ...b, isOwner: b.ownerId === userId }));
}
