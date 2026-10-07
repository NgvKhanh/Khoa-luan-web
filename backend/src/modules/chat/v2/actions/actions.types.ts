// Kieu dung chung cua lop hanh dong (CHATBOT_V2_ACTIONS_PLAN.md §9.3, §9.5). Chi la kieu: khong co ma chay.

import type { CardStatus } from '../../../../generated/prisma/enums';
import type { ActionOp, ActionType } from './actions.schema';

export type PlanStatus =
  | 'NEEDS_CHOICE'
  | 'PROPOSED'
  | 'EXECUTING'
  | 'EXECUTED'
  | 'FAILED'
  | 'STALE'
  | 'CANCELLED'
  | 'EXPIRED';
export type PlanRisk = 'LOW' | 'MEDIUM' | 'HIGH';
export type Provenance = 'USER_DIRECT' | 'DELEGATED_TO_DATA' | 'UNGROUNDED' | 'NOT_REQUESTED';

/** Ma loi hien cho nguoi dung / ghi vao ChatActionPlan.errorCode. */
export type ActionErrorCode =
  | 'ACTIONS_DISABLED'
  | 'AI_UNAVAILABLE'
  | 'NO_BOARD'
  | 'MULTI_OP'
  | 'NOT_REQUESTED'
  | 'NOT_FOUND'
  | 'AMBIGUOUS'
  | 'FORBIDDEN'
  | 'VIEWER_ASSIGN'
  | 'OUT_OF_SCOPE'
  | 'INVALID'
  | 'STALE'
  | 'EXPIRED'
  | 'ALREADY_DECIDED'
  | 'SUPERSEDED'
  | 'SCOPE_CHANGED'
  | 'SERVICE_ERROR';

/** Vi sao mot ke hoach hop le van CHUA tu chay. */
export type ConfirmReasonCode = 'AUTO_DISABLED' | 'DELEGATED_TO_DATA' | 'NOT_GROUNDED' | 'FUZZY_DATE' | 'QUESTION_FORM';
export interface ConfirmReason {
  code: ConfirmReasonCode;
  text: string;
}

/** Truong cua mot thao tac duoc phan giai: id THAT, gia tri cu (de kiem tien dieu kien), ten hien thi lay tu CSDL. */
export interface StoredOp {
  type: ActionType;
  ids: { card?: string; list?: string; member?: string; label?: string };
  /** `due`: thoi diem ISO (UTC) hoac null = bo han. */
  params: { title?: string; due?: string | null; status?: CardStatus };
  before: {
    title?: string;
    due?: string | null;
    listId?: string;
    listName?: string;
    status?: CardStatus;
    alreadyAssigned?: boolean;
    alreadyLabeled?: boolean;
  } | null;
  display: { cardTitle?: string; listName?: string; toListName?: string; memberName?: string; labelName?: string; dueText?: string };
  /** Khong thay doi gi (da dung roi) -> khong goi service. */
  noop?: string;
}

/** Tham chieu nhap nhang dang cho nguoi dung chon. */
export interface PendingChoice {
  path: 'card' | 'list' | 'toList' | 'member' | 'label';
  options: { id: string; label: string }[];
}

export interface StoredPlan {
  version: 1;
  boardId: string;
  boardName: string;
  /** Cau nguoi dung (de ghi vet; nguon cua giay phep dong tu; dung lai khi tiep tuc sau nut chon). */
  message: string;
  /** De xuat tuong trung cua LLM, NGUYEN VAN (de do dac / danh gia; khong dung de chay). */
  symbolic: ActionOp[];
  /** Thao tac da phan giai (rong khi con cho nguoi dung chon). */
  ops: StoredOp[];
  /** id da chon qua nut (hoac da resolve) - dung lai khi tiep tuc ke hoach sau lua chon. */
  presets: Partial<Record<PendingChoice['path'], string>>;
  pending?: PendingChoice;
  /** Ngay he thong da hieu (khong phai ngay LLM khai) + canh bao khi LLM khai khac. */
  warnings: string[];
}

export interface PlanItemView {
  index: number;
  verb: string;
  text: string;
  detail?: string;
  cardId?: string;
}

export interface PlanView {
  planId: string;
  checksum: string;
  status: PlanStatus;
  risk: PlanRisk;
  requiresConfirmation: boolean;
  /** true khi nut "Ap dung" con dung duoc (PROPOSED va chua het han). */
  canConfirm: boolean;
  reasons: ConfirmReason[];
  expiresAt: string;
  boardId: string;
  boardName: string;
  items: PlanItemView[];
  warnings: string[];
}

export type ResultStatus = 'EXECUTED' | 'FAILED' | 'STALE' | 'CANCELLED' | 'EXPIRED';
export interface ResultView {
  planId: string;
  status: ResultStatus;
  autoExecuted: boolean;
  alreadyApplied?: boolean;
  summary: string;
  boardId: string;
  cardId?: string;
  error?: { code: ActionErrorCode; text: string };
  warnings: string[];
}

export type ActionView = { kind: 'PLAN'; plan: PlanView } | { kind: 'RESULT'; result: ResultView };

/** Ket qua kiem tra quyen + nghiep vu (actions.guard). */
export type GuardVerdict = { ok: true } | { ok: false; code: ActionErrorCode; text: string };
