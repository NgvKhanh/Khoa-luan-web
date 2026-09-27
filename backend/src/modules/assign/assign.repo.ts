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
import { learningDecision, parseRunCandidates, type LearnReason } from './assign.learn';
import type { PlanCard } from './assign.plan';
import type { SnapshotCard, SnapshotMembership, SnapshotProfile } from './assign.snapshot';
// Tu buoc 11 den buoc 16 (§17.6): bang trong so chi co BA cot - doc/ghi ba khoa, gan Ho so = 0 khi dua vao bo hoc
import { pinLegacy, toLegacy, type LegacyWeights } from './assign.weights';

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
  weights: LegacyWeights;
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

/**
 * Cac the CHUA CO NGUOI NHAN cua mot danh sach - dau vao cua lop 2 (chia viec): chua xong, chua luu tru, chua xoa, khong co
 * thanh vien nao. Thu tu tra ve chi de on dinh; thu tu xu ly la urgencyOrder() (assign.plan.ts).
 */
export async function readPlanCards(listId: string): Promise<PlanCard[]> {
  return prisma.card.findMany({
    where: { listId, deletedAt: null, archivedAt: null, isDone: false, members: { none: {} } },
    select: { id: true, title: true, description: true, startDate: true, dueDate: true, position: true },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });
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

type Tx = Prisma.TransactionClient;

/**
 * Bao dam dong trong so cua nhom TON TAI roi KHOA no den het giao dich (SELECT ... FOR UPDATE): hai luot phan hoi,
 * hoac mot luot phan hoi va mot lan chinh tay, cung nhom se noi duoi nhau - khong ai doc gia tri cu roi ghi de mat cap
 * nhat cua nguoi kia. createMany + skipDuplicates = INSERT ... ON CONFLICT DO NOTHING nen hai giao dich cung tao dong
 * lan dau khong nem loi trung khoa.
 */
async function lockedWeightsRow(tx: Tx, workspaceId: string) {
  await tx.workspaceAssignWeights.createMany({ data: [{ workspaceId }], skipDuplicates: true });
  await tx.$queryRaw`SELECT "workspaceId" FROM "WorkspaceAssignWeights" WHERE "workspaceId" = ${workspaceId} FOR UPDATE`;
  return tx.workspaceAssignWeights.findUniqueOrThrow({ where: { workspaceId } });
}

/**
 * Ghi bo trong so CHINH TAY (hoac dat lai) va MOT dong lich su (`runId` = null) trong cung giao dich - de duong hoi tu
 * khong bao gio thieu mot buoc. `resetCount` dua so luot phan hoi ve 0. Trong so do HOC ghi o decideAndLearn.
 */
export async function saveWeights(
  workspaceId: string,
  weights: LegacyWeights,
  opts: { resetCount?: boolean } = {}
): Promise<StoredWeights> {
  return prisma.$transaction(async (tx) => {
    const existing = await lockedWeightsRow(tx, workspaceId);
    const values = {
      wExperience: weights.experience,
      wReliability: weights.reliability,
      wAvailability: weights.availability,
      feedbackCount: opts.resetCount ? 0 : existing.feedbackCount,
    };
    const row = await tx.workspaceAssignWeights.update({ where: { workspaceId }, data: values });
    await tx.assignWeightHistory.create({ data: { workspaceId, ...values, runId: null } });
    return toStored(row);
  });
}

export interface WeightHistoryRow {
  id: string;
  createdAt: Date;
  weights: LegacyWeights;
  feedbackCount: number;
  /** Luot goi y gay ra thay doi; null = chinh tay hoac dat lai. */
  runId: string | null;
}

/** Cac lan doi trong so gan nhat (moi nhat truoc) - dung ve duong hoi tu va cho nhom xem "vi sao no doi". */
export async function readWeightHistory(workspaceId: string, limit: number): Promise<WeightHistoryRow[]> {
  const rows = await prisma.assignWeightHistory.findMany({
    where: { workspaceId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    weights: { experience: r.wExperience, reliability: r.wReliability, availability: r.wAvailability },
    feedbackCount: r.feedbackCount,
    runId: r.runId,
  }));
}

/** Chi so danh gia truc tuyen (muc 1): so luot da co ket qua va so luot giao DUNG nguoi xep dau. */
export async function readFeedbackStats(workspaceId: string): Promise<{ decided: number; accepted: number }> {
  const [decided, accepted] = await Promise.all([
    prisma.assignRun.count({ where: { workspaceId, decidedAt: { not: null } } }),
    prisma.assignRun.count({ where: { workspaceId, decidedAt: { not: null }, accepted: true } }),
  ]);
  return { decided, accepted };
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

export interface LearnOutcome {
  /** So luot phan hoi cua nhom SAU luot nay. */
  feedbackCount: number;
  /** Trong so cua nhom SAU luot nay. */
  weights: LegacyWeights;
  learning: { learned: boolean; reason: LearnReason };
}

/**
 * Ghi nguoi duoc chon MOT LAN va - trong CUNG giao dich - cong luot phan hoi, roi hoc neu du dieu kien (assign.learn.ts):
 *  1. `updateMany where decidedAt = null`: chi mot request thang; thua thi tra null (nguoi goi doc lai ket qua that);
 *  2. khoa dong trong so cua nhom, cong feedbackCount, quyet dinh hoc bang ham thuan;
 *  3. neu hoc: ghi trong so moi + mot dong AssignWeightHistory (kem runId) + danh dau run.learned.
 * Tat ca hoac khong gi: loi giua chung thi luot nay van chua duoc quyet (khong co tinh trang "da ghi ma chua tinh").
 */
export async function decideAndLearn(
  run: RunRow & { workspaceId: string },
  chosenUserId: string,
  now: Date
): Promise<LearnOutcome | null> {
  return prisma.$transaction(async (tx) => {
    const accepted = run.topUserId !== null && run.topUserId === chosenUserId;
    const won = await tx.assignRun.updateMany({
      where: { id: run.id, decidedAt: null },
      data: { chosenUserId, accepted, decidedAt: now },
    });
    if (won.count !== 1) return null;

    const current = await lockedWeightsRow(tx, run.workspaceId);
    const currentWeights = toStored(current).weights;
    const feedbackCount = current.feedbackCount + 1;
    const decision = learningDecision({
      weights: pinLegacy(currentWeights),
      feedbackCount,
      topUserId: run.topUserId,
      chosenUserId,
      candidates: parseRunCandidates(run.candidates),
    });
    // Ho so = 0 khong bi bo hoc dong toi (chi chinh ba thanh phan lich su) nen cat ve ba khoa khong mat gi
    const next = decision.learn ? toLegacy(decision.next) : currentWeights;
    const values = {
      wExperience: next.experience,
      wReliability: next.reliability,
      wAvailability: next.availability,
      feedbackCount,
    };
    await tx.workspaceAssignWeights.update({ where: { workspaceId: run.workspaceId }, data: values });
    if (decision.learn) {
      await tx.assignWeightHistory.create({ data: { workspaceId: run.workspaceId, ...values, runId: run.id } });
      await tx.assignRun.update({ where: { id: run.id }, data: { learned: true } });
    }
    return { feedbackCount, weights: next, learning: { learned: decision.learn, reason: decision.reason } };
  });
}

// ---------- Ho so lam viec ca nhan (MemberWorkProfile) ----------

export interface StoredProfile {
  maxParallelCards: number;
  pausedUntil: Date | null;
  updatedAt: Date;
}

const PROFILE_SELECT = { maxParallelCards: true, pausedUntil: true, updatedAt: true } as const;

export function readWorkProfile(userId: string, workspaceId: string): Promise<StoredProfile | null> {
  return prisma.memberWorkProfile.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: PROFILE_SELECT,
  });
}

/**
 * Tao hoac cap nhat ho so cua CHINH nguoi dung trong khong gian. Upsert cua Prisma tren khoa (userId, workspaceId) la
 * mot cau INSERT ... ON CONFLICT DO UPDATE, nen bam Luu hai lan lien tiep (hoac hai tab) khong tranh nhau va khong nem
 * loi trung khoa - co test giu (mot giao dich khac vua tao dong nhung chua commit). Tung co vong "thu lai khi P2002" o
 * day nhung cai loi tu dong chung minh no khong bao gio chay toi (loai bo di van xanh), nen da bo.
 */
export function saveWorkProfile(
  userId: string,
  workspaceId: string,
  data: { maxParallelCards: number; pausedUntil: Date | null }
): Promise<StoredProfile> {
  return prisma.memberWorkProfile.upsert({
    where: { userId_workspaceId: { userId, workspaceId } },
    create: { userId, workspaceId, ...data },
    update: data,
    select: PROFILE_SELECT,
  });
}
