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

function refsOf(op: ActionOp): Array<[string, Ref]> {
  switch (op.type) {
    case 'CREATE_CARD':
      return op.list ? [['list', op.list]] : [];
    case 'RENAME_CARD':
    case 'SET_CARD_DUE':
    case 'SET_CARD_STATUS':
      return [['card', op.card]];
    case 'MOVE_CARD':
      return [
        ['card', op.card],
        ['toList', op.toList],
      ];
    case 'ASSIGN_MEMBER':
      return [
        ['card', op.card],
        ['member', op.member],
      ];
    case 'ADD_LABEL':
      return [
        ['card', op.card],
        ['label', op.label],
      ];
  }
}

function refGrounded(ref: Ref, words: readonly string[], message: string): boolean {
  switch (ref.by) {
    case 'TEXT':
      return groundedIn(ref.text, words);
    case 'CONTEXT':
      return hasContextCue(ref.slot, words);
    case 'SELF':
      return hasSelfCue(message);
  }
}

/** `message` la cau CUA NGUOI DUNG (da gop phan bo sung neu co), `today` la ngay lich hien tai o Viet Nam. */
export function assessProvenance(op: ActionOp, message: string, today: IsoDate): ProvenanceReport {
  const words = foldWords(message);
  const failures: ProvenanceFailure[] = [];
  const due = op.type === 'SET_CARD_DUE' ? groundDue(op.due, message, today) : undefined;

  const delegated = delegatesToData(words);
  if (delegated) failures.push({ code: 'DELEGATION_PHRASE' });

  const licence = licenceFor(op.type, words, op.type === 'SET_CARD_STATUS' ? op.status : undefined);
  if (!licence.licensed) failures.push({ code: 'OP_NOT_LICENSED' });
  else if (licence.negated) failures.push({ code: 'NEGATED' });

  if (delegated) return { verdict: 'DELEGATED_TO_DATA', failures, due };
  if (!licence.licensed || licence.negated) return { verdict: 'NOT_REQUESTED', failures, due };

  for (const [name, ref] of refsOf(op)) {
    if (!refGrounded(ref, words, message)) failures.push({ code: 'REF_NOT_GROUNDED', detail: name });
  }
  if ((op.type === 'CREATE_CARD' || op.type === 'RENAME_CARD') && !groundedIn(op.title, words, 0.8, false)) {
    failures.push({ code: 'TITLE_NOT_GROUNDED' });
  }
  if (op.type === 'SET_CARD_STATUS' && lastStatusMention(words) !== op.status) failures.push({ code: 'STATUS_NOT_GROUNDED' });
  if (due !== undefined && !due.grounded) failures.push({ code: 'DATE_NOT_GROUNDED' });
  if (isQuestionForm(message, words)) failures.push({ code: 'QUESTION_FORM' });

  return { verdict: failures.length === 0 ? 'USER_DIRECT' : 'UNGROUNDED', failures, due };
}
