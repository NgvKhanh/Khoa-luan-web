// Tang doc/ghi CSDL cua module goi y phan cong. CHI co Prisma, khong logic tinh diem: moi quy tac "the nao la
// lich su / dang mo" nam o assign.snapshot.ts (ham thuan, test khong can DB).
//
// Pham vi (ASSIGN_MODULE.md §2, §5.9): TAT CA doc du lieu theo KHONG GIAN LAM VIEC cua bang chua the. Khong doc
// cheo khong gian (MemberWorkProfile.allowCrossWorkspace chua duoc dung): bang chung se lo tieu de the cua
// khong gian khac. Bang/danh sach/the DA XOA bi loai; bang DA LUU TRU thi giu (chinh la "du an cu").

import { prisma } from '../../config/prisma';
import type { Prisma } from '../../generated/prisma/client';
import type { BoardVisibility } from '../../generated/prisma/enums';
import { workspaceRoleOf } from '../workspace/workspace.service';
import type { Weights } from './assign.score';
import type { SnapshotCard, SnapshotMembership, SnapshotProfile } from './assign.snapshot';

export interface BoardRef {
  id: string;
  ownerId: string;
  workspaceId: string;
  visibility: BoardVisibility;
}

export interface CandidateUser {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export type WorkspaceCard = SnapshotCard & { boardId: string };

export interface StoredWeights {
  weights: Weights;
  feedbackCount: number;
  updatedAt: Date;
}

export async function readBoardRef(boardId: string): Promise<BoardRef | null> {
  return prisma.board.findFirst({
    where: { id: boardId, deletedAt: null },
    select: { id: true, ownerId: true, workspaceId: true, visibility: true },
  });
}

/**
 * Ung vien = nguoi CO THE duoc gan vao the cua bang nay. PHAI khop isBoardParticipant() (board.service.ts) -
 * neu khong se goi y nguoi ma bam "giao" lai bi addCardMember tu choi 400. Gom: chu bang, thanh vien bang
 * khong phai VIEWER, va (bang o muc WORKSPACE) chu + thanh vien khong gian. Bo tai khoan da xoa.
 * Xep theo id de ket qua tat dinh.
 */
export async function readCandidates(board: BoardRef): Promise<CandidateUser[]> {
  const ids = new Set<string>([board.ownerId]);
  const members = await prisma.boardMember.findMany({
    where: { boardId: board.id, deletedAt: null, role: { not: 'VIEWER' } },
    select: { userId: true },
  });
  for (const m of members) ids.add(m.userId);

  if (board.visibility === 'WORKSPACE') {
    const ws = await prisma.workspace.findFirst({
      where: { id: board.workspaceId, deletedAt: null },
      select: { ownerId: true, members: { where: { deletedAt: null }, select: { userId: true } } },
    });
    if (ws) {
      ids.add(ws.ownerId);
      for (const m of ws.members) ids.add(m.userId);
    }
  }

  return prisma.user.findMany({
    where: { id: { in: [...ids] }, deletedAt: null },
    select: { id: true, name: true, avatarUrl: true },
    orderBy: { id: 'asc' },
  });
}

/** Moi the con hoat dong cua khong gian (kho ngu lieu + lich su + tai). */
export async function readWorkspaceCards(workspaceId: string): Promise<WorkspaceCard[]> {
  const rows = await prisma.card.findMany({
    where: { deletedAt: null, list: { deletedAt: null, board: { workspaceId, deletedAt: null } } },
    select: {
      id: true,
      title: true,
      description: true,
      createdAt: true,
      startDate: true,
      dueDate: true,
      isDone: true,
      completedAt: true,
      archivedAt: true,
      list: { select: { boardId: true, archivedAt: true, board: { select: { archivedAt: true } } } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    boardId: r.list.boardId,
    title: r.title,
    description: r.description,
    createdAt: r.createdAt,
    startDate: r.startDate,
    dueDate: r.dueDate,
    isDone: r.isDone,
    completedAt: r.completedAt,
    archived: r.archivedAt !== null || r.list.archivedAt !== null || r.list.board.archivedAt !== null,
  }));
}

/** Lien ket the-nguoi cua cac ung vien, trong cac the cua khong gian. */
export async function readMemberships(workspaceId: string, userIds: readonly string[]): Promise<SnapshotMembership[]> {
  if (userIds.length === 0) return [];
  return prisma.cardMember.findMany({
    where: {
      userId: { in: [...userIds] },
      card: { deletedAt: null, list: { deletedAt: null, board: { workspaceId, deletedAt: null } } },
    },
    select: { cardId: true, userId: true, createdAt: true },
  });
}

/** Id cac the tung bi bo danh dau xong roi danh dau lai (Activity `card.undone`). */
export async function readReopenedCardIds(workspaceId: string): Promise<Set<string>> {
  const rows = await prisma.activity.findMany({
    where: { type: 'card.undone', cardId: { not: null }, board: { workspaceId, deletedAt: null } },
    select: { cardId: true },
    distinct: ['cardId'],
  });
  const ids = new Set<string>();
  for (const r of rows) if (r.cardId !== null) ids.add(r.cardId);
  return ids;
}

export async function readProfiles(
  workspaceId: string,
  userIds: readonly string[]
): Promise<Map<string, SnapshotProfile>> {
  const map = new Map<string, SnapshotProfile>();
  if (userIds.length === 0) return map;
  const rows = await prisma.memberWorkProfile.findMany({
    where: { workspaceId, userId: { in: [...userIds] } },
    select: { userId: true, maxParallelCards: true, pausedUntil: true },
  });
  for (const r of rows) map.set(r.userId, { maxParallelCards: r.maxParallelCards, pausedUntil: r.pausedUntil });
  return map;
}

/**
 * Id cac bang cua khong gian ma `userId` XEM DUOC (dung de che tieu de bang chung). Phan biet voi
 * assertBoardView: khong loai bang da luu tru - thanh vien cua mot du an cu van co quyen xem no.
 */
export async function readViewableBoardIds(userId: string, workspaceId: string): Promise<Set<string>> {
  const isWorkspaceMember = (await workspaceRoleOf(userId, workspaceId)) !== null;
  const boards = await prisma.board.findMany({
    where: {
      workspaceId,
      deletedAt: null,
      OR: [
        { ownerId: userId },
        { members: { some: { userId, deletedAt: null } } },
        { visibility: 'PUBLIC' },
        ...(isWorkspaceMember ? [{ visibility: 'WORKSPACE' as const }] : []),
      ],
    },
    select: { id: true },
  });
  return new Set(boards.map((b) => b.id));
}

// ---------- Trong so ----------

const toStored = (r: {
  wExperience: number;
  wReliability: number;
  wAvailability: number;
  feedbackCount: number;
  updatedAt: Date;
}): StoredWeights => ({
  weights: { experience: r.wExperience, reliability: r.wReliability, availability: r.wAvailability },
  feedbackCount: r.feedbackCount,
  updatedAt: r.updatedAt,
});

export async function readWeights(workspaceId: string): Promise<StoredWeights | null> {
  const row = await prisma.workspaceAssignWeights.findUnique({ where: { workspaceId } });
  return row ? toStored(row) : null;
}

/**
 * Ghi bo trong so va MOT dong lich su (cung giao dich - de duong hoi tu khong bao gio thieu mot buoc).
 * `resetCount` dua so luot phan hoi ve 0. `runId` = luot goi y gay ra thay doi (null = chinh tay / dat lai).
 */
export async function saveWeights(
  workspaceId: string,
  weights: Weights,
  opts: { resetCount?: boolean; runId?: string | null } = {}
): Promise<StoredWeights> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.workspaceAssignWeights.findUnique({ where: { workspaceId } });
    const feedbackCount = opts.resetCount ? 0 : (existing?.feedbackCount ?? 0);
    const values = {
      wExperience: weights.experience,
      wReliability: weights.reliability,
      wAvailability: weights.availability,
      feedbackCount,
    };
    const row = await tx.workspaceAssignWeights.upsert({
      where: { workspaceId },
      create: { workspaceId, ...values },
      update: values,
    });
    await tx.assignWeightHistory.create({ data: { workspaceId, ...values, runId: opts.runId ?? null } });
    return toStored(row);
  });
}

// ---------- Nhat ky luot goi y ----------

export async function createRun(data: Prisma.AssignRunUncheckedCreateInput): Promise<string> {
  const run = await prisma.assignRun.create({ data, select: { id: true } });
  return run.id;
}

export type RunRow = NonNullable<Awaited<ReturnType<typeof findRun>>>;

export function findRun(runId: string) {
  return prisma.assignRun.findUnique({ where: { id: runId } });
}

/** Nguoi nay hien co trong the (CardMember) khong. */
export async function isOnCard(cardId: string, userId: string): Promise<boolean> {
  const m = await prisma.cardMember.findUnique({
    where: { cardId_userId: { cardId, userId } },
    select: { userId: true },
  });
  return m !== null;
}

/** Ghi nguoi duoc chon MOT LAN: chi thanh cong neu luot nay chua duoc quyet (2 request cung luc khong de len nhau). */
export async function decideRun(
  runId: string,
  data: { chosenUserId: string; accepted: boolean; decidedAt: Date }
): Promise<boolean> {
  const res = await prisma.assignRun.updateMany({ where: { id: runId, decidedAt: null }, data });
  return res.count === 1;
}
