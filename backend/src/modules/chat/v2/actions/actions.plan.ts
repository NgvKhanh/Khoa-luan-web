// Dung ke hoach / xem truoc / ket qua - HAM THUAN (CHATBOT_V2_ACTIONS_PLAN.md §9.5, §12). Moi chu hien cho nguoi dung duoc dung tu
// ke hoach DA RESOLVE (ten lay tu CSDL), khong tu chu LLM viet - nen LLM khong the "noi" voi nguoi dung dieu khac voi thao tac se chay.

import { createHash } from 'node:crypto';
import { STATUS_LABEL } from '../../../card/cardStatus';
import { formatDueDate, vnDayOfIso } from './actions.dates';
import type {
  ActionErrorCode,
  ConfirmReason,
  PlanItemView,
  PlanRisk,
  PlanStatus,
  PlanView,
  ResultStatus,
  ResultView,
  StoredOp,
} from './actions.types';

/** Ke hoach cho xem truoc song 10 phut. */
export const PLAN_TTL_MS = 10 * 60_000;

const q = (s: string | undefined): string => `“${s ?? ''}”`;

/** JSON on dinh: khoa sap xep, bo undefined - de checksum khong phu thuoc thu tu khoa. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/** Dau van tay cua ke hoach: chu nhan, bang, va tung thao tac (loai + id + tham so). Xac nhan phai gui lai dung gia tri nay. */
export function planChecksum(input: { userId: string; boardId: string; ops: readonly StoredOp[] }): string {
  const payload = {
    userId: input.userId,
    boardId: input.boardId,
    ops: input.ops.map((o) => ({ type: o.type, ids: o.ids, params: o.params })),
  };
  return createHash('sha256').update(canonicalJson(payload)).digest('hex');
}

function dueLabel(op: StoredOp): string {
  return op.params.due === null || op.params.due === undefined ? 'bỏ hạn' : formatDueDate(vnDayOfIso(op.params.due));
}

/** Mot dong trong khung xem truoc. */
export function describeOp(op: StoredOp, index: number): PlanItemView {
  const d = op.display;
  const cardId = op.ids.card;
  switch (op.type) {
    case 'CREATE_CARD':
      return { index, verb: 'Tạo thẻ', text: q(op.params.title), detail: `Trong cột ${q(d.listName)}` };
    case 'RENAME_CARD':
      return { index, verb: 'Đổi tên thẻ', text: `${q(op.before?.title)} → ${q(op.params.title)}`, cardId };
    case 'SET_CARD_DUE':
      return {
        index,
        verb: op.params.due === null ? 'Bỏ hạn' : 'Đặt hạn',
        text: q(d.cardTitle),
        detail: op.params.due === null ? undefined : `${dueLabel(op)}${op.before?.due ? ` (trước: ${formatDueDate(vnDayOfIso(op.before.due))})` : ''}`,
        cardId,
      };
    case 'MOVE_CARD':
      return { index, verb: 'Chuyển thẻ', text: q(d.cardTitle), detail: `${q(op.before?.listName)} → ${q(d.toListName)}`, cardId };
    case 'SET_CARD_STATUS':
      return {
        index,
        verb: 'Đổi trạng thái',
        text: q(d.cardTitle),
        detail: `${op.before?.status ? STATUS_LABEL[op.before.status] : '—'} → ${op.params.status ? STATUS_LABEL[op.params.status] : '—'}`,
        cardId,
      };
    case 'ASSIGN_MEMBER':
      return { index, verb: 'Giao thẻ', text: `${q(d.cardTitle)} cho ${d.memberName ?? ''}`, cardId };
    case 'ADD_LABEL':
      return { index, verb: 'Gắn nhãn', text: `${q(d.labelName)} vào thẻ ${q(d.cardTitle)}`, cardId };
  }
}

/** Cau ket qua khi thao tac da chay. `movedTo`: ten cot the tu chuyen sang (khi doi trang thai keo the sang cot khac). */
export function summarizeExecuted(op: StoredOp, extra: { movedTo?: string; createdTitle?: string } = {}): string {
  if (op.noop !== undefined) return op.noop;
  const d = op.display;
  switch (op.type) {
    case 'CREATE_CARD':
      return `Đã tạo thẻ ${q(extra.createdTitle ?? op.params.title)} trong cột ${q(d.listName)}.`;
    case 'RENAME_CARD':
      return `Đã đổi tên thẻ ${q(op.before?.title)} thành ${q(op.params.title)}.`;
    case 'SET_CARD_DUE':
      return op.params.due === null ? `Đã bỏ hạn của thẻ ${q(d.cardTitle)}.` : `Đã đặt hạn cho thẻ ${q(d.cardTitle)}: ${dueLabel(op)}.`;
    case 'MOVE_CARD':
      return `Đã chuyển thẻ ${q(d.cardTitle)} từ cột ${q(op.before?.listName)} sang ${q(d.toListName)}.`;
    case 'SET_CARD_STATUS': {
      const base = `Đã đổi trạng thái thẻ ${q(d.cardTitle)} thành “${op.params.status ? STATUS_LABEL[op.params.status] : ''}”.`;
      return extra.movedTo === undefined ? base : `${base} Thẻ tự chuyển sang cột ${q(extra.movedTo)}.`;
    }
    case 'ASSIGN_MEMBER':
      return `Đã giao thẻ ${q(d.cardTitle)} cho ${d.memberName ?? ''}.`;
    case 'ADD_LABEL':
      return `Đã gắn nhãn ${q(d.labelName)} vào thẻ ${q(d.cardTitle)}.`;
  }
}

const ERROR_TEXT: Partial<Record<ActionErrorCode, string>> = {
  FORBIDDEN: 'Bạn không còn quyền sửa bảng này nên chưa thay đổi gì.',
  NOT_FOUND: 'Thẻ, cột hoặc bảng này không còn tồn tại nên chưa thay đổi gì.',
  STALE: 'Dữ liệu đã thay đổi kể từ lúc xem trước nên chưa thay đổi gì. Hãy gửi lại lệnh.',
  EXPIRED: 'Kế hoạch đã hết hạn nên chưa thay đổi gì. Hãy gửi lại lệnh.',
  ALREADY_DECIDED: 'Kế hoạch này đã được xử lý.',
  SUPERSEDED: 'Đã có lệnh mới hơn nên kế hoạch này bị thay thế. Chưa thay đổi gì.',
  SCOPE_CHANGED: 'Bạn đã chuyển sang trang khác nên kế hoạch này đã bị hủy. Chưa thay đổi gì.',
  SERVICE_ERROR: 'Hệ thống chưa thực hiện được thao tác này. Chưa thay đổi gì.',
  INVALID: 'Thao tác không hợp lệ nên chưa thay đổi gì.',
  OUT_OF_SCOPE: 'Thao tác nằm ngoài phạm vi bảng hiện tại nên chưa thay đổi gì.',
};

export function errorText(code: ActionErrorCode, fallback?: string): string {
  return fallback ?? ERROR_TEXT[code] ?? 'Chưa thay đổi gì.';
}

export interface PlanViewInput {
  planId: string;
  checksum: string;
  status: PlanStatus;
  risk: PlanRisk;
  requiresConfirmation: boolean;
  reasons: readonly ConfirmReason[];
  expiresAt: Date;
  boardId: string;
  boardName: string;
  ops: readonly StoredOp[];
  warnings: readonly string[];
  now: Date;
}

export function buildPlanView(input: PlanViewInput): PlanView {
  return {
    planId: input.planId,
    checksum: input.checksum,
    status: input.status,
    risk: input.risk,
    requiresConfirmation: input.requiresConfirmation,
    canConfirm: input.status === 'PROPOSED' && input.expiresAt.getTime() > input.now.getTime(),
    reasons: [...input.reasons],
    expiresAt: input.expiresAt.toISOString(),
    boardId: input.boardId,
    boardName: input.boardName,
    items: input.ops.map((op, i) => describeOp(op, i)),
    warnings: [...input.warnings],
  };
}

export interface ResultViewInput {
  planId: string;
  status: ResultStatus;
  autoExecuted: boolean;
  alreadyApplied?: boolean;
  summary: string;
  boardId: string;
  cardId?: string;
  error?: { code: ActionErrorCode; text: string };
  warnings?: readonly string[];
}

export function buildResultView(input: ResultViewInput): ResultView {
  return {
    planId: input.planId,
    status: input.status,
    autoExecuted: input.autoExecuted,
    ...(input.alreadyApplied ? { alreadyApplied: true } : {}),
    summary: input.summary,
    boardId: input.boardId,
    ...(input.cardId !== undefined ? { cardId: input.cardId } : {}),
    ...(input.error !== undefined ? { error: input.error } : {}),
    warnings: [...(input.warnings ?? [])],
  };
}
