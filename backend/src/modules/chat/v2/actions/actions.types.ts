// Kieu dung chung cua lop hanh dong (CHATBOT_V2_ACTIONS_PLAN.md §9.3, §9.5). Chi la kieu: khong co ma chay.

import type { CardStatus } from '../../../../generated/prisma/enums';
import type { ActionOp, ActionType } from './actions.schema';
import type { SlotKind } from './actions.refs';

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
  | 'MULTI_OP' // Phase 1: chi mot thao tac / lan. Con lai de doc duoc hang cu trong CSDL, Phase 2 khong sinh ma nay nua
  | 'TOO_MANY_OPS'
  | 'TOO_MANY_CARDS'
  | 'TOO_MANY_LISTS'
  | 'TOO_MANY_REFS'
  | 'INVALID_PLAN' // do thi phu thuoc sai: trung key / tham chieu thieu / vong / sai loai / trung ten
  | 'CONFLICT' // hai thao tac mau thuan nhau tren cung mot doi tuong, hoac trung voi du lieu co san
  | 'INTERRUPTED' // hang EXECUTING tu Phase 1 bi bo do (tien trinh chet) - Phase 2 khong sinh ra nua
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
export type ConfirmReasonCode =
  | 'AUTO_DISABLED'
  | 'DELEGATED_TO_DATA'
  | 'NOT_GROUNDED'
  | 'FUZZY_DATE'
  | 'QUESTION_FORM'
  | 'MULTI_OP' // tu hai thao tac tro len = hang loat -> khong bao gio tu chay
  | 'NEW_STRUCTURE'; // tao cot: doi cau truc bang
export interface ConfirmReason {
  code: ConfirmReasonCode;
  text: string;
}

/** Truong cua mot thao tac duoc phan giai: id THAT, gia tri cu (de kiem tien dieu kien), ten hien thi lay tu CSDL. */
export interface StoredOp {
  type: ActionType;
  /** Chi thao tac TAO (CREATE_LIST / CREATE_CARD): khoa de thao tac sau tro toi thuc the vua tao. */
  key?: string;
  /** id cua thuc the CO SAN. Thuc the do chinh ke hoach tao thi KHONG co id o day ma nam o `local`. */
  ids: { card?: string; list?: string; member?: string; label?: string };
  /** Tham chieu noi bo: key cua thao tac tao ra the / cot ma thao tac nay dung (id chi co sau khi thao tac do chay). */
  local?: { card?: string; list?: string };
  /** `due`: thoi diem ISO (UTC) hoac null = bo han. `listStatus`: trang thai cot moi (doan theo ten, giong tao cot bang tay). */
  params: { title?: string; name?: string; due?: string | null; status?: CardStatus; listStatus?: CardStatus | null };
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

/** Tham chieu nhap nhang dang cho nguoi dung chon. `sig` = dau van tay cua tham chieu (actions.refs): mot lan chon ap dung cho moi cho nhac cung chu. */
export interface PendingChoice {
  sig: string;
  kind: SlotKind;
  /** Chu nguoi dung go cho tham chieu nay ("" khi khong noi, vd tao the ma khong noi cot). */
  text: string;
  options: { id: string; label: string }[];
}

export interface StoredPlan {
  /** 1 = Phase 1 (mot thao tac, presets theo ten o), 2 = Phase 2 (nhieu thao tac, presets theo dau van tay). */
  version: 1 | 2;
  boardId: string;
  boardName: string;
  /** Cau nguoi dung (de ghi vet; nguon cua giay phep dong tu; dung lai khi tiep tuc sau nut chon). */
  message: string;
  /** De xuat tuong trung cua LLM, NGUYEN VAN (de do dac / danh gia; khong dung de chay). */
  symbolic: ActionOp[];
  /** Thao tac da phan giai (rong khi con cho nguoi dung chon). */
  ops: StoredOp[];
  /**
   * id da GHIM theo dau van tay tham chieu: lua chon bang nut + cac "no / the vua roi" da hieu luc de xuat. Dung lai khi tiep tuc sau
   * lua chon va khi DUNG LAI ke hoach luc ap dung (de phat hien du lieu doi) - nen ket qua khong phu thuoc phien hoi thoai.
   */
  presets: Record<string, string>;
  pending?: PendingChoice;
  /** Dau van tay trang thai luc xem truoc (ids + tham so + gia tri cu + ten hien thi): ap dung phai dung lai ra DUNG gia tri nay. */
  stateDigest?: string;
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
  /** Phase 2 (them, tuong thich nguoc): so thao tac. */
  opCount: number;
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
  /** Phase 2 (them, tuong thich nguoc): so thao tac da chay va mot cau cho moi thao tac (chi khi tu hai thao tac tro len). */
  opCount?: number;
  details?: string[];
  cardIds?: string[];
}

export type ActionView = { kind: 'PLAN'; plan: PlanView } | { kind: 'RESULT'; result: ResultView };

/** Ket qua kiem tra quyen + nghiep vu (actions.guard). */
export type GuardVerdict = { ok: true } | { ok: false; code: ActionErrorCode; text: string };
