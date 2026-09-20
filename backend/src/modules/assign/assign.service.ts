// Goi y phan cong: noi cac tang (doc CSDL -> anh chup -> bo cham -> che rieng tu -> nhat ky) va quyen truy cap.
// Lich su thiet ke: ASSIGN_MODULE.md §4 (kien truc), §9-10 (bang, API). Bo cham nam o assign.score.ts (ham thuan);
// file nay khong tinh diem, chi lap dau vao va dong goi dau ra.

import { AppError } from '../../utils/AppError';
import { assertCardAccess } from '../card/card.service';
import { assertWorkspaceAccess, assertWorkspaceManage } from '../workspace/workspace.service';
import {
  createRun,
  decideRun,
  findRun,
  isOnCard,
  readBoardRef,
  readCandidates,
  readMemberships,
  readProfiles,
  readReopenedCardIds,
  readViewableBoardIds,
  readWeights,
  readWorkspaceCards,
  saveWeights,
  type RunRow,
  type StoredWeights,
} from './assign.repo';
import {
  DEFAULT_WEIGHTS,
  rankCandidates,
  type CandidateScore,
  type ConfidenceLevel,
  type Flag,
  type OutcomeKind,
  type Weights,
} from './assign.score';
import { buildSnapshot } from './assign.snapshot';
import { isDefaultWeights, sameWeights, weightIssues } from './assign.weights';

// Hai lua chon cua bo cham duoc ghi RO o day (khong dua vao mac dinh cua assign.score.ts) de mot lan ai do doi
// mac dinh thi nhat ky khong noi doi: phien ban thuat toan luon mo ta dung thu da chay.
const NORMALIZE = 'MINMAX' as const;
const MISSING = 'DROP' as const;
export const ALGORITHM_VERSION = `knn-tfidf-v1/${NORMALIZE.toLowerCase()}/${MISSING.toLowerCase()}`;

// ===================== Goi y cho mot the =====================

export interface SuggestionEvidence {
  cardId: string;
  /** null = the nay thuoc bang ma nguoi hoi KHONG xem duoc (rieng tu): che tieu de, diem van tinh ca no. */
  title: string | null;
  sim: number;
  weight: number;
  outcome: OutcomeKind;
  completedAt: Date;
  dueDate: Date | null;
}

export interface Suggestion {
  rank: number;
  /** Co y khong co email: ket qua nay hien cho moi nguoi sua duoc the. */
  user: { id: string; name: string; avatarUrl: string | null };
  /** Diem TUONG DOI trong nhom ung vien cua the nay (0-100), null neu khong co du lieu. Khong so sanh duoc giua hai the. */
  score: number | null;
  /** Diem tho theo §5.7 nguyen van. */
  rawScore: number | null;
  confidence: number;
  confidenceLevel: ConfidenceLevel;
  components: CandidateScore['components'];
  fit: number;
  evidenceMass: number;
  load: number;
  capacity: number;
  flags: Flag[];
  /** Da o trong the nay roi. */
  assigned: boolean;
  evidence: SuggestionEvidence[];
}

export interface SuggestionResult {
  /** null khi khong co ung vien nao (khong ghi nhat ky). */
  runId: string | null;
  card: { id: string; title: string; boardId: string; workspaceId: string };
  algorithmVersion: string;
  generatedAt: Date;
  weights: Weights & { custom: boolean };
  /** `muy` cua nhom, null neu chua the nao co han. */
  groupOnTimeRate: number | null;
  candidateCount: number;
  candidates: Suggestion[];
}

/**
 * Xep hang nhung nguoi co the nhan the `cardId`, dua tren lich su cua khong gian chua the.
 * `now` mac dinh la bay gio; test truyen vao de chay lai "tai mot thoi diem" (khong doc dong ho ben trong).
 * Co ghi 1 dong AssignRun (nhat ky + nguon do ti le chap nhan) - vi vay route co gioi han toc do.
 */
export async function suggestForCard(userId: string, cardId: string, now: Date = new Date()): Promise<SuggestionResult> {
  const startedAt = Date.now();
  // Quyen: dung dung ham cua thao tac sua the -> VIEWER bi chan, nguoi ngoai bang bi chan
  const card = await assertCardAccess(userId, cardId);
  const board = await readBoardRef(card.list.boardId);
  if (!board) throw new AppError('Khong tim thay bang', 404);

  const candidateUsers = await readCandidates(board);
  const candidateIds = candidateUsers.map((u) => u.id);

  const [cards, memberships, reopened, profiles, stored, viewable] = await Promise.all([
    readWorkspaceCards(board.workspaceId),
    readMemberships(board.workspaceId, candidateIds),
    readReopenedCardIds(board.workspaceId),
    readProfiles(board.workspaceId, candidateIds),
    readWeights(board.workspaceId),
    readViewableBoardIds(userId, board.workspaceId),
  ]);

  // Trong so luu hong (sua tay trong CSDL) khong duoc lam mat goi y cua ca nhom: lui ve mac dinh
  let weights: Weights = { ...DEFAULT_WEIGHTS };
  if (stored) {
    if (weightIssues(stored.weights).length === 0) weights = stored.weights;
    else console.warn(`[assign] trong so cua khong gian ${board.workspaceId} khong hop le, dung mac dinh`);
  }

  const snapshot = buildSnapshot({
    cards,
    memberships,
    reopened,
    profiles,
    candidateIds,
    targetCardId: card.id,
    now,
  });
  const ranked = rankCandidates(
    { id: card.id, title: card.title, description: card.description, startDate: card.startDate, dueDate: card.dueDate },
    snapshot.candidates,
    { idf: snapshot.idf, now, groupOnTimeRate: snapshot.mu, weights, normalize: NORMALIZE, missing: MISSING }
  );

  const userById = new Map(candidateUsers.map((u) => [u.id, u]));
  const boardOfCard = new Map(cards.map((c) => [c.id, c.boardId]));
  const assignedIds = new Set(memberships.filter((m) => m.cardId === card.id).map((m) => m.userId));
  // Che that bai theo huong AN: khong biet the thuoc bang nao -> coi nhu khong xem duoc
  const canSee = (evidenceCardId: string) => {
    const b = boardOfCard.get(evidenceCardId);
    return b !== undefined && viewable.has(b);
  };

  const candidates: Suggestion[] = ranked.map((r) => {
    const u = userById.get(r.userId)!;
    return {
      rank: r.rank,
      user: { id: u.id, name: u.name, avatarUrl: u.avatarUrl },
      score: r.score,
      rawScore: r.rawScore,
      confidence: r.confidence,
      confidenceLevel: r.confidenceLevel,
      components: r.components,
      fit: r.fit,
      evidenceMass: r.evidenceMass,
      load: r.load,
      capacity: r.capacity,
      flags: r.flags,
      assigned: assignedIds.has(r.userId),
      evidence: r.evidence.map((e) => ({
        cardId: e.cardId,
        title: canSee(e.cardId) ? e.title : null,
        sim: e.sim,
        weight: e.weight,
        outcome: e.outcome,
        completedAt: e.completedAt,
        dueDate: e.dueDate,
      })),
    };
  });

  let runId: string | null = null;
  if (ranked.length > 0) {
    const top = ranked[0]!;
    runId = await createRun({
      workspaceId: board.workspaceId,
      boardId: board.id,
      cardId: card.id,
      actorKey: userId,
      algorithmVersion: ALGORITHM_VERSION,
      weights: { ...weights },
      // Nhat ky KHONG chep tieu de the (chi id) - de khong nhan ban noi dung co the la cua bang rieng tu
      candidates: ranked.map((r) => ({
        userId: r.userId,
        rank: r.rank,
        score: r.score,
        rawScore: r.rawScore,
        confidence: r.confidence,
        confidenceLevel: r.confidenceLevel,
        load: r.load,
        capacity: r.capacity,
        flags: r.flags,
        components: {
          experience: { value: r.components.experience.value, scaled: r.components.experience.scaled, share: r.components.experience.share },
          reliability: { value: r.components.reliability.value, scaled: r.components.reliability.scaled, share: r.components.reliability.share },
          availability: { value: r.components.availability.value, scaled: r.components.availability.scaled, share: r.components.availability.share },
        },
        evidence: r.evidence.map((e) => ({ cardId: e.cardId, sim: e.sim, weight: e.weight, outcome: e.outcome })),
      })),
      candidateCount: ranked.length,
      topUserId: top.score !== null ? top.userId : null,
      latencyMs: Date.now() - startedAt,
    });
  }

  return {
    runId,
    card: { id: card.id, title: card.title, boardId: board.id, workspaceId: board.workspaceId },
    algorithmVersion: ALGORITHM_VERSION,
    generatedAt: now,
    weights: { ...weights, custom: !isDefaultWeights(weights) },
    groupOnTimeRate: snapshot.mu,
    candidateCount: ranked.length,
    candidates,
  };
}

// ===================== Ghi nguoi duoc chon =====================

export interface OutcomeResult {
  runId: string;
  chosenUserId: string;
  topUserId: string | null;
  /** Nguoi duoc chon chinh la nguoi xep dau. */
  accepted: boolean;
  decidedAt: Date;
  /** Buoc 5 chi GHI NHAN (muc 1); cap nhat trong so (muc 2) o buoc 6. */
  learned: boolean;
}

/**
 * Ghi nguoi thuc su duoc giao sau mot luot goi y. Chi nguoi da bam goi y duoc ghi; nguoi do phai con quyen sua the,
 * va nguoi duoc chon PHAI dang o trong the (khong tin loi khai cua client - nhat ky nay se nuoi viec hoc trong so).
 * Chi ghi MOT lan: gui lai dung nguoi cu la khong lam gi (200), gui nguoi khac la 409.
 */
export async function recordOutcome(
  userId: string,
  runId: string,
  chosenUserId: string,
  now: Date = new Date()
): Promise<OutcomeResult> {
  const run = await findRun(runId);
  // Luot cua nguoi khac cung tra 404: khong lo ra la no ton tai
  if (!run || run.actorKey !== userId) throw new AppError('Khong tim thay luot goi y', 404);
  if (!run.cardId) throw new AppError('The cua luot goi y nay da bi xoa', 409);
  await assertCardAccess(userId, run.cardId);

  if (run.decidedAt) return replayOutcome(run, chosenUserId);

  if (!(await isOnCard(run.cardId, chosenUserId))) throw new AppError('Nguoi nay chua duoc gan vao the', 400);

  const accepted = run.topUserId !== null && run.topUserId === chosenUserId;
  if (await decideRun(run.id, { chosenUserId, accepted, decidedAt: now })) {
    return { runId: run.id, chosenUserId, topUserId: run.topUserId, accepted, decidedAt: now, learned: run.learned };
  }

  // Thua cuoc dua: mot request khac vua ghi truoc. Doc lai ket qua that.
  const latest = await findRun(run.id);
  if (!latest?.decidedAt) throw new AppError('Khong ghi duoc ket qua, vui long thu lai', 409);
  return replayOutcome(latest, chosenUserId);
}

/** Luot da duoc quyet: cung nguoi -> tra lai ket qua da luu; nguoi khac -> 409. */
function replayOutcome(run: RunRow, chosenUserId: string): OutcomeResult {
  if (run.chosenUserId !== chosenUserId || !run.decidedAt) {
    throw new AppError('Luot goi y nay da duoc ghi nguoi khac', 409);
  }
  return {
    runId: run.id,
    chosenUserId,
    topUserId: run.topUserId,
    accepted: run.accepted,
    decidedAt: run.decidedAt,
    learned: run.learned,
  };
}

// ===================== Trong so cua khong gian =====================

export interface WorkspaceWeightsView {
  workspaceId: string;
  weights: Weights;
  defaults: Weights;
  /** Khac mac dinh. */
  custom: boolean;
  feedbackCount: number;
  /** null = chua tung chinh (dang dung mac dinh). */
  updatedAt: Date | null;
}

function viewOf(workspaceId: string, stored: StoredWeights | null): WorkspaceWeightsView {
  const weights: Weights = stored ? { ...stored.weights } : { ...DEFAULT_WEIGHTS };
  return {
    workspaceId,
    weights,
    defaults: { ...DEFAULT_WEIGHTS },
    custom: !isDefaultWeights(weights),
    feedbackCount: stored?.feedbackCount ?? 0,
    updatedAt: stored?.updatedAt ?? null,
  };
}

/** Moi thanh vien cua khong gian xem duoc trong so dang dung (khong giau). */
export async function getWorkspaceWeights(userId: string, workspaceId: string): Promise<WorkspaceWeightsView> {
  await assertWorkspaceAccess(userId, workspaceId);
  return viewOf(workspaceId, await readWeights(workspaceId));
}

/** Chi OWNER/ADMIN cua khong gian. Kiem tra CHAT (khong tu sua ngam); dat giong het gia tri hien tai thi khong ghi gi. */
export async function setWorkspaceWeights(userId: string, workspaceId: string, input: Weights): Promise<WorkspaceWeightsView> {
  await assertWorkspaceManage(userId, workspaceId);
  const issues = weightIssues(input);
  if (issues.length > 0) {
    throw new AppError(`Trong so khong hop le: ${issues.map((i) => i.message).join('; ')}`, 400);
  }
  const next: Weights = { experience: input.experience, reliability: input.reliability, availability: input.availability };
  const current = await readWeights(workspaceId);
  if (sameWeights(current?.weights ?? DEFAULT_WEIGHTS, next)) return viewOf(workspaceId, current);
  return viewOf(workspaceId, await saveWeights(workspaceId, next));
}

/** Dat lai 0,45 / 0,30 / 0,25 va dua so luot phan hoi ve 0 (quy tac "du 10 luot moi hoc" ap dung lai). */
export async function resetWorkspaceWeights(userId: string, workspaceId: string): Promise<WorkspaceWeightsView> {
  await assertWorkspaceManage(userId, workspaceId);
  const current = await readWeights(workspaceId);
  if (!current || (isDefaultWeights(current.weights) && current.feedbackCount === 0)) {
    return viewOf(workspaceId, current);
  }
  return viewOf(workspaceId, await saveWeights(workspaceId, DEFAULT_WEIGHTS, { resetCount: true }));
}
