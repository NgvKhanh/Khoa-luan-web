// NGUON GOC cua mot hanh dong (CHATBOT_V2_ACTIONS_PLAN.md §5; dieu kien 1 va 7 cua chinh sach auto-run).
//
// Phan biet DU LIEU voi CHI DAN: ten the / cot / nguoi / nhan trong du lieu chi dung de TIM doi tuong ("Login" trong "Chuyen
// task Login sang Done" la mot tham chieu du lieu), con NGUON cua hanh dong phai la chinh cau cua nguoi dung. Ham thuan:
//  - "giay phep dong tu": cau co dong tu cho dung loai thao tac (va khong bi phu dinh);
//  - "gan vao cau": chu trong tham so (tieu de moi, ten the / cot / nguoi / nhan, trang thai, ngay) co mat trong cau;
//  - "giao cho du lieu": cau bao "lam theo noi dung the / mo ta / binh luan..." -> chi dan khong phai cua nguoi dung.
// Mot cau hoi binh thuong ma mo ta the chua "giao het cho X" khong the sinh ra thao tac nao tu chay: cau khong co dong tu giao.

import type { IsoDate } from '../../../ai/ai.dates';
import { groundDue, type DueGrounding } from './actions.dates';
import { slotsOf } from './actions.refs';
import type { ActionOp, Ref } from './actions.schema';
import {
  delegatesToData,
  foldWords,
  groundedIn,
  hasContextCue,
  hasSelfCue,
  isQuestionForm,
  lastStatusMention,
  licenceFor,
} from './actions.text';

export type ProvenanceCode =
  | 'OP_NOT_LICENSED'
  | 'NEGATED'
  | 'DELEGATION_PHRASE'
  | 'QUESTION_FORM'
  | 'TITLE_NOT_GROUNDED'
  | 'REF_NOT_GROUNDED'
  | 'STATUS_NOT_GROUNDED'
  | 'DATE_NOT_GROUNDED';

export interface ProvenanceFailure {
  code: ProvenanceCode;
  detail?: string;
}

/** NOT_REQUESTED: cau khong yeu cau thao tac nay (khong co dong tu / bi phu dinh) -> tu choi, khong cho xem truoc. */
export type ProvenanceVerdict = 'USER_DIRECT' | 'DELEGATED_TO_DATA' | 'UNGROUNDED' | 'NOT_REQUESTED';

export interface ProvenanceReport {
  verdict: ProvenanceVerdict;
  failures: ProvenanceFailure[];
  /** Chi voi SET_CARD_DUE: ngay he thong da hieu (dung lai o buoc xem truoc, khong tinh hai lan). */
  due?: DueGrounding;
}

function refGrounded(ref: Ref, words: readonly string[], message: string): boolean {
  switch (ref.by) {
    case 'TEXT':
      return groundedIn(ref.text, words);
    case 'CONTEXT':
      return hasContextCue(ref.slot, words);
    case 'SELF':
      return hasSelfCue(message);
    case 'PLAN':
      // thuc the do CHINH ke hoach tao: khong phai du lieu co san nen khong co "chu de gan vao cau"
      return true;
  }
}

/** `message` la cau CUA NGUOI DUNG (da gop phan bo sung neu co), `today` la ngay lich hien tai o Viet Nam. */
export function assessProvenance(op: ActionOp, message: string, today: IsoDate, strictStatus = true): ProvenanceReport {
  const words = foldWords(message);
  const failures: ProvenanceFailure[] = [];
  const due = op.type === 'SET_CARD_DUE' ? groundDue(op.due, message, today) : undefined;

  const delegated = delegatesToData(words);
  if (delegated) failures.push({ code: 'DELEGATION_PHRASE' });

  const licence = licenceFor(op.type, words, op.type === 'SET_CARD_STATUS' ? op.status : undefined, strictStatus);
  if (!licence.licensed) failures.push({ code: 'OP_NOT_LICENSED' });
  else if (licence.negated) failures.push({ code: 'NEGATED' });

  if (delegated) return { verdict: 'DELEGATED_TO_DATA', failures, due };
  if (!licence.licensed || licence.negated) return { verdict: 'NOT_REQUESTED', failures, due };

  for (const slot of slotsOf(op)) {
    if (slot.ref !== undefined && !refGrounded(slot.ref, words, message)) failures.push({ code: 'REF_NOT_GROUNDED', detail: slot.name });
  }
  if ((op.type === 'CREATE_CARD' || op.type === 'RENAME_CARD') && !groundedIn(op.title, words, 0.8, false)) {
    failures.push({ code: 'TITLE_NOT_GROUNDED' });
  }
  if (op.type === 'CREATE_LIST' && !groundedIn(op.name, words, 0.8, false)) failures.push({ code: 'TITLE_NOT_GROUNDED' });
  if (op.type === 'SET_CARD_STATUS' && strictStatus && lastStatusMention(words) !== op.status) failures.push({ code: 'STATUS_NOT_GROUNDED' });
  if (due !== undefined && !due.grounded) failures.push({ code: 'DATE_NOT_GROUNDED' });
  if (isQuestionForm(message, words)) failures.push({ code: 'QUESTION_FORM' });

  return { verdict: failures.length === 0 ? 'USER_DIRECT' : 'UNGROUNDED', failures, due };
}

export interface PlanProvenance extends ProvenanceReport {
  /** Nguon goc tung thao tac (cung thu tu voi danh sach thao tac duoc danh gia). */
  perOp: ProvenanceReport[];
  /** Co thao tac nao dung ngay mo ("cuoi tuan"). */
  dueFuzzy: boolean;
  /** Chi so thao tac dau tien khong duoc yeu cau (neu co). */
  firstNotRequested?: number;
}

const RANK: Record<ProvenanceVerdict, number> = { USER_DIRECT: 0, UNGROUNDED: 1, DELEGATED_TO_DATA: 2, NOT_REQUESTED: 3 };

/**
 * Nguon goc cua CA ke hoach = nguon goc TE NHAT trong cac thao tac: chi can mot thao tac khong duoc cau nguoi dung yeu cau (NOT_REQUESTED)
 * la tu choi ca ke hoach (khong am tham bo mot phan roi chay phan con lai); mot thao tac giao cho du lieu / dien giai lai -> ca ke hoach
 * phai xem lai. Moi thao tac duoc xet doc lap tren CUNG cau cua nguoi dung.
 */
export function assessPlanProvenance(ops: readonly ActionOp[], message: string, today: IsoDate): PlanProvenance {
  // nhieu thao tac doi trang thai trong cung mot cau thi khong the doi moi trang thai la trang thai nhac CUOI
  const strictStatus = ops.filter((op) => op.type === 'SET_CARD_STATUS').length <= 1;
  const perOp = ops.map((op) => assessProvenance(op, message, today, strictStatus));
  let verdict: ProvenanceVerdict = 'USER_DIRECT';
  for (const r of perOp) if (RANK[r.verdict] > RANK[verdict]) verdict = r.verdict;
  const failures = perOp.flatMap((r, i) => r.failures.map((f) => ({ ...f, detail: f.detail !== undefined ? `op${i + 1}:${f.detail}` : `op${i + 1}` })));
  const firstNotRequested = perOp.findIndex((r) => r.verdict === 'NOT_REQUESTED');
  return {
    verdict,
    failures,
    perOp,
    dueFuzzy: perOp.some((r) => r.due?.fuzzy === true),
    ...(firstNotRequested >= 0 ? { firstNotRequested } : {}),
  };
}
