// CHINH SACH TU CHAY AN TOAN (CHATBOT_V2_ACTIONS_PLAN.md §5). Ham thuan: nhan cac su that da biet, tra ve AUTO / CONFIRM / REFUSE.
//
// Tam dieu kien (theo yeu cau 07/10) de mot thao tac duoc TU CHAY, khong can bam "Ap dung":
//   1. nguon cua hanh dong la lenh truc tiep cua nguoi dung        -> provenance = USER_DIRECT
//   2. thao tac thuoc whitelist an toan (7 thao tac)               -> ACTION_TYPES
//   3. moi tham chieu resolve DUNG MOT doi tuong                   -> refsUnique
//   4. chi tac dong MOT bang, nam trong tran pham vi               -> boardIds / inCeiling
//   5. khong hang loat, khong huy hoai                             -> opsCount === MAX_OPS_PER_PLAN, khong co bo chon / xoa
//   6. khong doi quyen / vai tro / chu so huu / hien thi           -> khong the dien dat (schema dong)
//   7. khong thuc thi chi dan lay tu du lieu                       -> provenance khong phai DELEGATED_TO_DATA / UNGROUNDED
//   8. backend kiem quyen + nghiep vu truoc khi chay               -> guard
// Khong dat -> CONFIRM (xem truoc + bam Ap dung, kem ly do) hoac REFUSE (khong ghi gi). Ten the xuat hien trong ngu canh hoi
// thoai KHONG con lam mat tu cach tu chay: chi NGUON CUA LENH moi duoc xet.

import { ACTION_TYPES, MAX_OPS_PER_PLAN, type ActionType } from './actions.schema';
import type { ProvenanceReport } from './actions.provenance';
import type { ActionErrorCode, ConfirmReason, GuardVerdict, PlanRisk } from './actions.types';

export const SAFE_ACTION_TYPES: readonly ActionType[] = ACTION_TYPES;

export interface DecisionInput {
  opsCount: number;
  opType: string;
  provenance: ProvenanceReport;
  /** Ngay han la moc mo ("cuoi tuan") -> nen cho nguoi dung xem lai. */
  dueFuzzy: boolean;
  /** Moi tham chieu da resolve ra dung mot doi tuong (lua chon bang nut cua nguoi dung cung tinh la duy nhat). */
  refsUnique: boolean;
  /** Cac bang (khong trung) cua moi id duoc nhac. */
  boardIds: readonly string[];
  /** Bang cua ke hoach nam trong tran pham vi hien tai. */
  inCeiling: boolean;
  guard: GuardVerdict;
  /** Co CHAT_AUTO_EXECUTE. */
  autoExecute: boolean;
}

export type Decision =
  | { mode: 'AUTO'; risk: 'LOW'; reasons: ConfirmReason[] }
  | { mode: 'CONFIRM'; risk: PlanRisk; reasons: ConfirmReason[] }
  | { mode: 'REFUSE'; code: ActionErrorCode; text: string };

export const CONFIRM_REASON_TEXT: Record<ConfirmReason['code'], string> = {
  AUTO_DISABLED: 'Chế độ tự chạy đang tắt nên mọi thao tác cần bạn xác nhận.',
  DELEGATED_TO_DATA:
    'Bạn nhờ làm theo nội dung nằm trong dữ liệu (thẻ, mô tả, bình luận…). Chỉ dẫn này đến từ dữ liệu chứ không phải từ chính câu lệnh của bạn nên thao tác không tự chạy.',
  NOT_GROUNDED: 'Mình đã diễn giải lại câu của bạn (tên hoặc nội dung chưa khớp hẳn với chữ bạn gõ) nên cần bạn xác nhận.',
  FUZZY_DATE: 'Ngày hạn bạn nói còn mơ hồ (ví dụ “cuối tuần”). Hãy kiểm tra ngày mình đã hiểu.',
  QUESTION_FORM: 'Câu của bạn có dạng câu hỏi nên mình chỉ làm khi bạn xác nhận.',
};

const refuse = (code: ActionErrorCode, text: string): Decision => ({ mode: 'REFUSE', code, text });

/**
 * Cau khong yeu cau thao tac nay (khong co dong tu / bi phu dinh) -> tu choi NGAY, truoc ca khi tim doi tuong: khong hien nut
 * chon cho mot lenh ma nguoi dung khong he ra. Dung chung voi decideExecution de van ban chi nam o mot cho.
 */
export function refusalBeforeResolve(provenance: ProvenanceReport): Extract<Decision, { mode: 'REFUSE' }> | null {
  if (provenance.verdict !== 'NOT_REQUESTED') return null;
  return {
    mode: 'REFUSE',
    code: 'NOT_REQUESTED',
    text: 'Mình chưa thấy câu của bạn yêu cầu thao tác này nên chưa thay đổi gì. Hãy nói rõ lệnh, ví dụ: “Chuyển Login sang Done”.',
  };
}

export function decideExecution(input: DecisionInput): Decision {
  // A8: quyen + nghiep vu truoc het - khong co quyen thi khong co gi de ban
  if (!input.guard.ok) return refuse(input.guard.code, input.guard.text);
  // A5: mot thao tac moi lan
  if (input.opsCount !== MAX_OPS_PER_PLAN) {
    return refuse('MULTI_OP', 'Hiện trợ lý chỉ thực hiện một thao tác mỗi lần. Hãy gửi từng lệnh một. Chưa thay đổi gì.');
  }
  // A2 + A6: whitelist (schema da dong; kiem lai de ham nay tu bao ve)
  if (!(SAFE_ACTION_TYPES as readonly string[]).includes(input.opType)) {
    return refuse('INVALID', 'Thao tác này chưa được trợ lý hỗ trợ. Chưa thay đổi gì.');
  }
  // A4: mot bang, trong tran
  if (input.boardIds.length !== 1 || !input.inCeiling) {
    return refuse('OUT_OF_SCOPE', 'Thao tác nằm ngoài phạm vi bảng hiện tại. Chưa thay đổi gì.');
  }
  // A3
  if (!input.refsUnique) return refuse('AMBIGUOUS', 'Còn đối tượng chưa xác định được duy nhất. Chưa thay đổi gì.');
  // A1: cau khong yeu cau thao tac nay
  const notRequested = refusalBeforeResolve(input.provenance);
  if (notRequested) return notRequested;

  const reasons: ConfirmReason[] = [];
  const push = (code: ConfirmReason['code']) => reasons.push({ code, text: CONFIRM_REASON_TEXT[code] });
  if (input.provenance.verdict === 'DELEGATED_TO_DATA') push('DELEGATED_TO_DATA');
  if (input.provenance.verdict === 'UNGROUNDED') {
    if (input.provenance.failures.some((f) => f.code === 'QUESTION_FORM')) push('QUESTION_FORM');
    if (input.provenance.failures.some((f) => f.code !== 'QUESTION_FORM')) push('NOT_GROUNDED');
  }
  if (input.dueFuzzy) push('FUZZY_DATE');
  if (!input.autoExecute) push('AUTO_DISABLED');

  if (reasons.length === 0) return { mode: 'AUTO', risk: 'LOW', reasons };
  // chi vi tat tu chay thi van la lenh ro rang cua nguoi dung -> LOW; con lai la lenh can xem lai -> MEDIUM
  return { mode: 'CONFIRM', risk: reasons.every((r) => r.code === 'AUTO_DISABLED') ? 'LOW' : 'MEDIUM', reasons };
}
