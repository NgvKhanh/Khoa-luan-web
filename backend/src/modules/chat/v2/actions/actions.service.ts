// DICH VU HANH DONG cua chatbot v2 - Phase 1 (CHATBOT_V2_ACTIONS_PLAN.md §6).
//
// Cac cua vao (chi cua dau tien dung LLM; tu do ve sau LLM khong con tham gia):
//   proposeActions : LLM da de xuat 1 thao tac tuong trung -> phan giai -> kiem quyen -> TU CHAY hoac XEM TRUOC
//   choosePlanRef  : nguoi dung bam nut chon (tham chieu nhap nhang) -> tiep tuc DUNG ke hoach dang do
//   confirmPlan    : nut "Ap dung"          cancelPlan : nut "Huy"          planView : xem lai trang thai that
//   typedPlanCommand : go "huy" -> huy ke hoach dang mo; go "ok / ap dung" -> KHONG xac nhan, nhac bam nut
//
// Moi ke hoach nam o bang ChatActionPlan nen khong phu thuoc phien trong bo nho (may chu khoi dong lai van xac nhan duoc).
// Moi lan cham toi ke hoach deu kiem lai: chu so huu, hoi thoai, han, checksum, tran pham vi, quyen. Executor chi goi service co san.

import { prisma } from '../../../../config/prisma';
import { AppError } from '../../../../utils/AppError';
import { vnToday } from '../../chat.period';
import type { ChatScopeInput } from '../../chat.scope';
import type { EntityOption } from '../chat.v2.entities';
import { OUT_OF_CEILING, resolveExecutionContext, type ExecutionContext } from '../chat.v2.scope';
import type { V2Session } from '../chat.v2.session';
import { decideExecution, refusalBeforeResolve } from './actions.autorun';
import { runClaimedPlan } from './actions.executor';
import { guardOp } from './actions.guard';
import { buildPlanView, buildResultView, describeOp, errorText, planChecksum } from './actions.plan';
import {
  cancelOpenPlans,
  cancelPlanRow,
  claimPlan,
  createPlanRow,
  expireIfNeeded,
  findOpenPlan,
  findOwnedPlan,
  replacePlan,
  type NewPlan,
  type PlanRow,
} from './actions.plan.repo';
import { assessProvenance, type ProvenanceReport } from './actions.provenance';
import { resolveOp, type Presets, type ResolveResult } from './actions.resolve';
import { MAX_OPS_PER_PLAN, type ActionOp } from './actions.schema';
import { foldWords } from './actions.text';
import type {
  ActionErrorCode,
  ActionView,
  ConfirmReason,
  PendingChoice,
  PlanRisk,
  PlanStatus,
  Provenance,
  ResultStatus,
  ResultView,
  StoredOp,
  StoredPlan,
} from './actions.types';

/** Thong tin ve lan goi LLM da sinh ra de xuat (ghi vao ChatActionPlan de do dac / truy vet). */
export interface PlanMeta {
  provider: string;
  model: string;
  adapter: string;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number | null;
}

/** Phan cua phien hoi thoai ma lop hanh dong duoc doc (khong sua). */
export interface ActionSession {
  id: string;
  userId: string;
  uiScope: ChatScopeInput;
  scope?: ChatScopeInput;
  bindings: readonly EntityOption[];
}

export interface ActionOutcome {
  /** Khoi hien thi (xem truoc / ket qua). Vang khi chi la loi nhac bang chu (tu choi, hoi lai). */
  action?: ActionView;
  text: string;
  /** Ma tu choi (de ghi vet / kiem thu): co khi khong chay gi. */
  refusal?: ActionErrorCode;
  /** Doi tuong dua vao ngu canh hoi thoai de hieu "no" o cau sau. */
  bind: EntityOption[];
  /** Cau hoi tiep theo (chon doi tuong / nhap ten bang). */
  pending?: NonNullable<V2Session['pending']>;
}

export const PREVIEW_TEXT = 'Mình sẽ làm như sau. Bấm “Áp dụng” để thực hiện hoặc “Hủy” để bỏ qua.';
const NO_BOARD_TEXT =
  'Bạn muốn thao tác ở bảng nào? Hãy trả lời dạng “bảng Marketing” (hoặc mở bảng đó rồi nhờ mình). Chưa thay đổi gì.';
const MULTI_OP_TEXT = 'Hiện trợ lý chỉ thực hiện một thao tác mỗi lần. Hãy gửi từng lệnh một. Chưa thay đổi gì.';
const CANCELLED_TEXT = 'Đã hủy kế hoạch. Chưa thay đổi gì.';

const KIND_OF_PATH: Record<PendingChoice['path'], EntityOption['kind']> = {
  card: 'CARD',
  list: 'COLUMN',
  toList: 'COLUMN',
  member: 'MEMBER',
  label: 'LABEL',
};
const WHAT: Record<PendingChoice['path'], string> = { card: 'thẻ', list: 'cột', toList: 'cột đích', member: 'người', label: 'nhãn' };

// ---------------------------------------------------------------------------------------------------------------------
// Bang dich + tran pham vi
// ---------------------------------------------------------------------------------------------------------------------

interface Target {
  exec: ExecutionContext;
  boardId: string;
  boardName: string;
}
type TargetResult = { ok: true; target: Target } | { ok: false; code: ActionErrorCode; text: string };

/**
 * Bang cua ke hoach = bang ma `exec` da kep ve (trang bang: dung bang do; trang chu: bang da nhac ten trong hoi thoai). Khong biet
 * bang nao -> NO_BOARD (hoi lai). Moi ke hoach CHI tac dong mot bang (D5).
 */
async function targetBoard(session: ActionSession, now: Date): Promise<TargetResult> {
  let exec: ExecutionContext;
  try {
    exec = await resolveExecutionContext({ userId: session.userId, now, scope: session.uiScope, conversationScope: session.scope });
  } catch (e) {
    if (e instanceof AppError && e.statusCode < 500) {
      if (e.message === OUT_OF_CEILING) return { ok: false, code: 'OUT_OF_SCOPE', text: `${OUT_OF_CEILING} Chưa thay đổi gì.` };
      return e.statusCode === 404
        ? { ok: false, code: 'NOT_FOUND', text: 'Không tìm thấy bảng này (có thể đã bị xóa hoặc lưu trữ). Chưa thay đổi gì.' }
        : { ok: false, code: 'FORBIDDEN', text: 'Bạn không còn quyền với bảng này. Chưa thay đổi gì.' };
    }
    throw e;
  }
  const board = exec.scope.board;
  if (exec.scope.kind !== 'BOARD' || board === null) return { ok: false, code: 'NO_BOARD', text: NO_BOARD_TEXT };
  return { ok: true, target: { exec, boardId: board.id, boardName: board.name } };
}

/** Bang nam trong tran pham vi cua giao dien? (trang bang: dung bang do; khong gian: bang cua khong gian do; trang chu: moi bang). */
export async function boardInCeiling(scope: ChatScopeInput, boardId: string): Promise<boolean> {
  if (scope.kind === 'MY') return true;
  if (scope.kind === 'BOARD') return scope.boardId === boardId;
  return (await prisma.board.count({ where: { id: boardId, workspaceId: scope.workspaceId } })) > 0;
}

// ---------------------------------------------------------------------------------------------------------------------
// Ghi ke hoach
// ---------------------------------------------------------------------------------------------------------------------

interface Base {
  session: ActionSession;
  now: Date;
  message: string;
  symbolic: ActionOp[];
  meta: PlanMeta;
  autoExecute: boolean;
}

interface Run {
  base: Base;
  target: Target;
  op: ActionOp;
  prov: ProvenanceReport;
  inCeiling: boolean;
  presets: Presets;
  existing: PlanRow | null;
}

interface PlanData {
  plan: StoredPlan;
  risk: PlanRisk;
  requiresConfirmation: boolean;
  reasons: readonly ConfirmReason[];
  provenance: Provenance;
  status: PlanStatus;
  autoExecuted?: boolean;
  errorCode?: ActionErrorCode;
}

function storedPlan(base: Base, target: Target | null, ops: StoredOp[], extra: Partial<StoredPlan> = {}): StoredPlan {
  return {
    version: 1,
    boardId: target?.boardId ?? '',
    boardName: target?.boardName ?? '',
    message: base.message,
    symbolic: base.symbolic,
    ops,
    presets: {},
    warnings: [],
    ...extra,
  };
}

async function persist(base: Base, target: Target | null, data: PlanData, existing: PlanRow | null): Promise<PlanRow> {
  const userId = base.session.userId;
  const input: NewPlan = {
    userId,
    conversationId: base.session.id,
    boardId: target?.boardId ?? null,
    scopeKind: base.session.uiScope.kind,
    prompt: base.message,
    plan: data.plan,
    checksum: planChecksum({ userId, boardId: target?.boardId ?? '', ops: data.plan.ops }),
    risk: data.risk,
    requiresConfirmation: data.requiresConfirmation,
    reasons: data.reasons,
    provenance: data.provenance,
    status: data.status,
    ...(data.autoExecuted !== undefined ? { autoExecuted: data.autoExecuted } : {}),
    ...(data.errorCode !== undefined ? { errorCode: data.errorCode } : {}),
    now: base.now,
    meta: base.meta,
  };
  if (!existing) return createPlanRow(input);
  const updated = await replacePlan(existing.id, input);
  // da bi huy / het han giua luc nguoi dung bam nut -> khong tiep tuc
  if (!updated) throw new AppError('Kế hoạch đã hết hạn hoặc đã bị hủy. Hãy gửi lại lệnh.', 409);
  return updated;
}

/** Ghi vet mot lan TU CHOI (khong chay gi) va tra loi bang chu. */
async function refuse(
  base: Base,
  target: Target | null,
  code: ActionErrorCode,
  text: string,
  extra: { ops?: StoredOp[]; provenance?: Provenance; presets?: Presets; existing?: PlanRow | null; pending?: ActionOutcome['pending'] } = {}
): Promise<ActionOutcome> {
  await persist(
    base,
    target,
    {
      plan: storedPlan(base, target, extra.ops ?? [], { presets: extra.presets ?? {} }),
      risk: 'LOW',
      requiresConfirmation: false,
      reasons: [],
      provenance: extra.provenance ?? 'UNGROUNDED',
      status: 'FAILED',
      errorCode: code,
    },
    extra.existing ?? null
  );
  return { text, refusal: code, bind: [], ...(extra.pending !== undefined ? { pending: extra.pending } : {}) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Dung khoi hien thi
// ---------------------------------------------------------------------------------------------------------------------

function planViewOf(row: PlanRow, stored: StoredPlan, status: PlanStatus, now: Date) {
  return buildPlanView({
    planId: row.id,
    checksum: row.checksum,
    status,
    risk: row.risk,
    requiresConfirmation: row.requiresConfirmation,
    reasons: (row.reasons as unknown as ConfirmReason[] | null) ?? [],
    expiresAt: row.expiresAt,
    boardId: stored.boardId,
    boardName: stored.boardName,
    ops: stored.ops,
    warnings: stored.warnings ?? [],
    now,
  });
}

function bindingsOf(op: StoredOp, result: ResultView, boardName: string): EntityOption[] {
  if (result.status !== 'EXECUTED') return [];
  const out: EntityOption[] = [];
  const cardId = result.cardId ?? op.ids.card;
  const title = op.type === 'CREATE_CARD' || op.type === 'RENAME_CARD' ? op.params.title : op.display.cardTitle;
  if (cardId !== undefined && title !== undefined) out.push({ id: cardId, name: title, kind: 'CARD', parentName: boardName });
  if ((op.type === 'MOVE_CARD' || op.type === 'CREATE_CARD') && op.ids.list !== undefined) {
    const name = op.display.toListName ?? op.display.listName;
    if (name !== undefined) out.push({ id: op.ids.list, name, kind: 'COLUMN', parentName: boardName });
  }
  return out;
}

/** Ket qua da luu (hoac suy ra tu trang thai) cua mot ke hoach DA CHOT. `replay` = lan tra loi thu hai tro di. */
export function resultFromRow(row: PlanRow, replay = false): ResultView {
  const plan = row.plan as unknown as StoredPlan;
  const saved = row.result as unknown as (ResultView & { detail?: string }) | null;
  if (saved && (row.status === 'EXECUTED' || row.status === 'FAILED' || row.status === 'STALE')) {
    const { detail: _detail, ...view } = saved;
    return { ...view, planId: row.id, status: row.status, ...(replay && row.status === 'EXECUTED' ? { alreadyApplied: true } : {}) };
  }
  const code = row.errorCode as ActionErrorCode | null;
  const status: ResultStatus =
    row.status === 'EXECUTED' || row.status === 'FAILED' || row.status === 'STALE' || row.status === 'CANCELLED' || row.status === 'EXPIRED'
      ? row.status
      : 'FAILED';
  let summary: string;
  if (status === 'CANCELLED') summary = code === 'SCOPE_CHANGED' || code === 'SUPERSEDED' ? errorText(code) : CANCELLED_TEXT;
  else if (status === 'EXPIRED') summary = errorText('EXPIRED');
  else summary = errorText(code ?? 'INVALID');
  return buildResultView({
    planId: row.id,
    status,
    autoExecuted: row.autoExecuted,
    summary,
    boardId: plan.boardId,
    ...(code !== null && ['SCOPE_CHANGED', 'SUPERSEDED', 'EXPIRED', 'STALE', 'FORBIDDEN', 'NOT_FOUND', 'INVALID'].includes(code)
      ? { error: { code, text: summary } }
      : {}),
    warnings: plan.warnings ?? [],
  });
}

/** Khoi hien thi THAT cua mot ke hoach (de phu len ban chup cu khi mo lai lich su). Het han tinh theo `now`, khong ghi CSDL. */
export function viewFromRow(row: PlanRow, now: Date): ActionView {
  const stored = row.plan as unknown as StoredPlan;
  const open = row.status === 'PROPOSED' || row.status === 'NEEDS_CHOICE';
  const status: PlanStatus = open && row.expiresAt.getTime() <= now.getTime() ? 'EXPIRED' : row.status;
  if (status === 'PROPOSED' || status === 'NEEDS_CHOICE' || status === 'EXECUTING') {
    return { kind: 'PLAN', plan: planViewOf(row, stored, status, now) };
  }
  return { kind: 'RESULT', result: resultFromRow({ ...row, status }, false) };
}

function labelOf(stored: StoredPlan): string {
  const first = stored.ops[0];
  if (!first) return 'kế hoạch';
  const item = describeOp(first, 0);
  return `${item.verb} ${item.text}`.slice(0, 120);
}

// ---------------------------------------------------------------------------------------------------------------------
// De xuat -> tu chay / xem truoc
// ---------------------------------------------------------------------------------------------------------------------

export interface ProposeInput {
  session: ActionSession;
  now: Date;
  /** Cau CUA NGUOI DUNG (da gop phan bo sung): nguon cua giay phep dong tu va cua viec "gan vao cau". */
  message: string;
  operations: readonly ActionOp[];
  autoExecute: boolean;
  meta: PlanMeta;
}

async function needsChoice(run: Run, pending: PendingChoice): Promise<ActionOutcome> {
  const { base, target } = run;
  const row = await persist(
    base,
    target,
    {
      plan: storedPlan(base, target, [], { presets: run.presets, pending }),
      risk: 'LOW',
      requiresConfirmation: true,
      reasons: [],
      provenance: run.prov.verdict,
      status: 'NEEDS_CHOICE',
    },
    run.existing
  );
  // tao the ma khong noi cot nao: khong co gi "khop" ca, chi la chua noi
  const noColumnNamed = pending.path === 'list' && run.op.type === 'CREATE_CARD' && run.op.list === undefined;
  const question = noColumnNamed
    ? 'Bạn muốn tạo thẻ trong cột nào?'
    : `Có nhiều ${WHAT[pending.path]} khớp với câu của bạn. Bạn muốn chọn ${WHAT[pending.path]} nào?`;
  return {
    text: question,
    bind: [],
    pending: {
      kind: 'PLAN_REF',
      planId: row.id,
      original: base.message,
      question,
      options: pending.options.map((o) => ({ id: o.id, name: o.label, kind: KIND_OF_PATH[pending.path] })),
    },
  };
}

/** Ket qua phan giai -> chinh sach tu chay -> luu ke hoach -> (tu chay | xem truoc | tu choi). */
async function conclude(run: Run, resolved: ResolveResult): Promise<ActionOutcome> {
  const { base, target } = run;
  const userId = base.session.userId;
  const fail = (code: ActionErrorCode, text: string, ops: StoredOp[]) =>
    refuse(base, target, code, text, { ops, provenance: run.prov.verdict, presets: run.presets, existing: run.existing });

  if (resolved.kind === 'FAIL') return fail(resolved.code, resolved.text, []);
  if (resolved.kind === 'CHOICE') return needsChoice(run, resolved.pending);

  const op = resolved.op;
  const guard = await guardOp({ userId, boardId: target.boardId, op });
  const decision = decideExecution({
    opsCount: base.symbolic.length,
    opType: op.type,
    provenance: run.prov,
    dueFuzzy: run.prov.due?.fuzzy ?? false,
    refsUnique: true, // resolveOp chi tra OK khi moi tham chieu da la DUNG MOT (hoac nguoi dung vua tu chon bang nut)
    boardIds: [target.boardId],
    inCeiling: run.inCeiling,
    guard,
    autoExecute: base.autoExecute,
  });
  if (decision.mode === 'REFUSE') return fail(decision.code, decision.text, [op]);

  // thao tac KHONG doi gi (da dung roi) thi khong co gi de xac nhan: chay thang (executor khong goi service)
  const auto = decision.mode === 'AUTO' || op.noop !== undefined;
  const stored = storedPlan(base, target, [op], { presets: run.presets, warnings: resolved.warnings });
  const row = await persist(
    base,
    target,
    {
      plan: stored,
      risk: auto ? 'LOW' : decision.risk,
      requiresConfirmation: !auto,
      reasons: auto ? [] : decision.reasons,
      provenance: run.prov.verdict,
      status: 'PROPOSED',
      autoExecuted: auto,
    },
    run.existing
  );
  // mot lenh moi thay the cac ke hoach dang mo truoc do trong hoi thoai
  await cancelOpenPlans(userId, base.session.id, 'SUPERSEDED', base.now, { except: row.id });

  if (!auto || !(await claimPlan(row.id, userId, base.now))) {
    return { text: PREVIEW_TEXT, action: { kind: 'PLAN', plan: planViewOf(row, stored, 'PROPOSED', base.now) }, bind: [] };
  }
  const out = await runClaimedPlan(row, base.now, true);
  return { text: out.result.summary, action: { kind: 'RESULT', result: out.result }, bind: bindingsOf(op, out.result, target.boardName) };
}

export async function proposeActions(input: ProposeInput): Promise<ActionOutcome> {
  const { session, now, message, meta } = input;
  const symbolic = [...input.operations];
  const base: Base = { session, now, message, symbolic, meta, autoExecute: input.autoExecute };

  // mot ke hoach = mot thao tac (Phase 1); schema van nhan toi vai thao tac de tu choi RO RANG thay vi bao loi cu phap
  if (symbolic.length !== MAX_OPS_PER_PLAN) return refuse(base, null, 'MULTI_OP', MULTI_OP_TEXT);
  const op = symbolic[0];

  // Nguon goc chi phu thuoc cau + de xuat (khong can biet bang): tinh TRUOC de (1) lenh khong he duoc yeu cau bi tu choi ngay, khong
  // hoi "bang nao?" cho mot viec nguoi dung khong nhờ, (2) dong kiem toan luon ghi dung nguon goc ke ca khi thieu bang.
  const prov = assessProvenance(op, message, vnToday(now));
  const early = refusalBeforeResolve(prov);
  const found = await targetBoard(session, now);
  if (early) return refuse(base, found.ok ? found.target : null, early.code, early.text, { provenance: prov.verdict });
  if (!found.ok) {
    return refuse(base, null, found.code, found.text, {
      provenance: prov.verdict,
      ...(found.code === 'NO_BOARD'
        ? { pending: { kind: 'QUESTION', original: message, question: found.text, options: [] } as const }
        : {}),
    });
  }
  const { target } = found;

  const run: Run = { base, target, op, prov, inCeiling: await boardInCeiling(session.uiScope, target.boardId), presets: {}, existing: null };
  const resolved = await resolveOp(
    { userId: session.userId, exec: target.exec, boardId: target.boardId, bindings: session.bindings, due: prov.due },
    op,
    {}
  );
  return conclude(run, resolved);
}

/** Ghi vet mot lan tu choi khong gan voi thao tac cu the (de xuat khong hop le sau khi da cho mo hinh sua mot lan...). */
export async function recordRefusal(
  input: { session: ActionSession; now: Date; message: string; meta: PlanMeta },
  code: ActionErrorCode,
  text: string
): Promise<ActionOutcome> {
  return refuse({ ...input, symbolic: [], autoExecute: false }, null, code, text);
}

export interface ChoiceInput {
  session: ActionSession;
  planId: string;
  optionId: string;
  now: Date;
  autoExecute: boolean;
}

/** Nguoi dung bam nut chon mot doi tuong: tiep tuc DUNG ke hoach dang do, KHONG goi lai LLM. */
export async function choosePlanRef(input: ChoiceInput): Promise<ActionOutcome> {
  const { session, planId, optionId, now } = input;
  const found = await findOwnedPlan(session.userId, planId);
  if (!found || found.conversationId !== session.id) throw new AppError('Không tìm thấy kế hoạch.', 404);
  const row = await expireIfNeeded(found, now);
  if (row.status !== 'NEEDS_CHOICE') throw new AppError('Lựa chọn này đã hết hạn hoặc đã được xử lý. Hãy gửi lại lệnh.', 409);

  const stored = row.plan as unknown as StoredPlan;
  const pending = stored.pending;
  if (!pending || !pending.options.some((o) => o.id === optionId)) throw new AppError('Lựa chọn không hợp lệ', 400);
  const presets: Presets = { ...stored.presets, [pending.path]: optionId };
  const meta: PlanMeta = {
    provider: row.provider ?? 'unknown',
    model: row.model ?? 'unknown',
    adapter: row.adapter ?? 'unknown',
    promptTokens: row.promptTokens,
    completionTokens: row.completionTokens,
    latencyMs: row.latencyMs,
  };
  const base: Base = { session, now, message: stored.message, symbolic: stored.symbolic, meta, autoExecute: input.autoExecute };

  const found2 = await targetBoard(session, now);
  if (!found2.ok) return refuse(base, null, found2.code, found2.text, { presets, existing: row });
  const { target } = found2;
  if (target.boardId !== stored.boardId) {
    // nguoi dung da sang bang / trang khac giua hai buoc
    await cancelPlanRow(row.id, session.userId, 'SCOPE_CHANGED', now);
    return { text: errorText('SCOPE_CHANGED'), refusal: 'SCOPE_CHANGED', bind: [] };
  }
  const op = stored.symbolic[0];
  const prov = assessProvenance(op, stored.message, vnToday(now));
  const run: Run = { base, target, op, prov, inCeiling: await boardInCeiling(session.uiScope, target.boardId), presets, existing: row };
  const resolved = await resolveOp(
    { userId: session.userId, exec: target.exec, boardId: target.boardId, bindings: session.bindings, due: prov.due },
    op,
    presets
  );
  return conclude(run, resolved);
}

// ---------------------------------------------------------------------------------------------------------------------
// Ap dung / huy / xem lai
// ---------------------------------------------------------------------------------------------------------------------

export interface PlanDecision {
  result: ResultView;
  text: string;
  bind: EntityOption[];
  /** Mo ta ngan cua ke hoach (ghi vao lich su: "Ap dung: ..."). */
  label: string;
}

const NOT_FOUND_PLAN = 'Không tìm thấy kế hoạch.';

async function ownedPlan(userId: string, planId: string, conversationId: string): Promise<PlanRow> {
  const row = await findOwnedPlan(userId, planId);
  // nguoi khac / hoi thoai khac -> cung mot cau tra loi nhu "khong ton tai" (khong lo la co ke hoach)
  if (!row || row.conversationId !== conversationId) throw new AppError(NOT_FOUND_PLAN, 404);
  return row;
}

function decided(row: PlanRow, replay: boolean): PlanDecision {
  const result = resultFromRow(row, replay);
  return { result, text: result.summary, bind: [], label: labelOf(row.plan as unknown as StoredPlan) };
}

export interface ConfirmInput {
  userId: string;
  planId: string;
  conversationId: string;
  checksum: string;
  /** Pham vi giao dien HIEN TAI (khong phai luc de xuat): ke hoach cua bang khac bi huy. */
  scope: ChatScopeInput;
  now: Date;
}

/** Nut "Ap dung". Khong goi LLM. Nhan cho nguyen tu: bam hai lan / hai tab chi chay mot lan, lan sau nhan lai ket qua da luu. */
export async function confirmPlan(input: ConfirmInput): Promise<PlanDecision> {
  const { userId, planId, now } = input;
  let row = await expireIfNeeded(await ownedPlan(userId, planId, input.conversationId), now);

  if (row.status === 'NEEDS_CHOICE') throw new AppError('Hãy chọn đối tượng trước khi áp dụng.', 409);
  if (row.status === 'EXECUTING') throw new AppError('Kế hoạch đang được thực hiện. Hãy chờ một chút.', 409);
  if (row.status !== 'PROPOSED') return decided(row, true);

  const stored = row.plan as unknown as StoredPlan;
  if (row.checksum !== input.checksum) throw new AppError('Kế hoạch không khớp với bản xem trước. Hãy gửi lại lệnh.', 409);
  if (row.boardId === null || !(await boardInCeiling(input.scope, row.boardId))) {
    await cancelPlanRow(row.id, userId, 'SCOPE_CHANGED', now);
    return decided((await findOwnedPlan(userId, planId)) ?? row, false);
  }

  if (!(await claimPlan(planId, userId, now))) {
    // co nguoi / tien trinh khac thang cuoc dua (hoac vua het han)
    row = (await findOwnedPlan(userId, planId)) ?? row;
    row = await expireIfNeeded(row, now);
    if (row.status === 'EXECUTING') throw new AppError('Kế hoạch đang được thực hiện. Hãy chờ một chút.', 409);
    return decided(row, true);
  }
  const out = await runClaimedPlan(row, now, false);
  const op = stored.ops[0];
  return {
    result: out.result,
    text: out.result.summary,
    bind: op ? bindingsOf(op, out.result, stored.boardName) : [],
    label: labelOf(stored),
  };
}

export interface CancelInput {
  userId: string;
  planId: string;
  conversationId: string;
  now: Date;
}

/** Nut "Huy" (hoac go "huy"). Lap lai an toan: huy hai lan van la "da huy"; ke hoach da chay thi tra ket qua that. */
export async function cancelPlan(input: CancelInput): Promise<PlanDecision> {
  const { userId, planId, now } = input;
  let row = await expireIfNeeded(await ownedPlan(userId, planId, input.conversationId), now);
  if (row.status === 'PROPOSED' || row.status === 'NEEDS_CHOICE') {
    await cancelPlanRow(row.id, userId, null, now);
    row = (await findOwnedPlan(userId, planId)) ?? row;
  }
  if (row.status === 'EXECUTING') throw new AppError('Kế hoạch đang được thực hiện nên chưa hủy được.', 409);
  return decided(row, false);
}

/** Trang thai that (de giao dien tai lai). Chi chu ke hoach xem duoc. */
export async function planView(userId: string, planId: string, now: Date): Promise<ActionView> {
  const row = await findOwnedPlan(userId, planId);
  if (!row) throw new AppError(NOT_FOUND_PLAN, 404);
  return viewFromRow(row, now);
}

// ---------------------------------------------------------------------------------------------------------------------
// Lenh go bang chu: "huy" huy ke hoach dang mo; "ok / ap dung" KHONG xac nhan (chi nut moi xac nhan)
// ---------------------------------------------------------------------------------------------------------------------

const CANCEL_WORDS: readonly string[] = [
  'huy',
  'huy di',
  'huy ke hoach',
  'huy cai vua roi',
  'huy lenh',
  'thoi',
  'thoi khong lam nua',
  'khong lam nua',
  'khong can nua',
  'dung lai',
];
const CONFIRM_WORDS: readonly string[] = [
  'ok',
  'oke',
  'okay',
  'yes',
  'co',
  'duoc',
  'dong y',
  'ap dung',
  'ap dung di',
  'xac nhan',
  'lam di',
  'chay di',
  'thuc hien di',
  'thuc hien',
];

/** null = khong phai lenh go hoac khong co ke hoach dang mo -> xu ly nhu cau hoi binh thuong. */
export async function typedPlanCommand(session: ActionSession, message: string, now: Date): Promise<ActionOutcome | null> {
  const folded = foldWords(message).join(' ');
  const cancel = CANCEL_WORDS.includes(folded);
  const confirm = CONFIRM_WORDS.includes(folded);
  if (!cancel && !confirm) return null;
  const open = await findOpenPlan(session.userId, session.id, now);
  if (!open) return null;
  if (confirm) {
    return {
      text: 'Để tránh làm nhầm, mình chỉ áp dụng khi bạn bấm nút “Áp dụng” trên bản xem trước (gõ “ok” thì mình không chạy). Chưa thay đổi gì.',
      bind: [],
    };
  }
  const res = await cancelPlan({ userId: session.userId, planId: open.id, conversationId: session.id, now });
  return { text: res.text, action: { kind: 'RESULT', result: res.result }, bind: [] };
}
