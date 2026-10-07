// QUYEN + NGHIEP VU cua tung thao tac (CHATBOT_V2_ACTIONS_PLAN.md §8). Dieu kien 8 cua chinh sach auto-run: backend LUON kiem lai
// truoc khi chay, ke ca khi nguoi dung da bam "Ap dung" - quyen co the vua doi giua hai buoc.
//
// KHONG viet lai quyen: goi dung cac ham `assert*` ma giao dien / API dang dung (board.service, card.service). VIEWER bi chan o
// assertBoardAccess; nguoi nhan phai qua isBoardParticipant (VIEWER bi loai - CODE_REVIEW #9). Ket qua tra ve ma + cau tieng Viet
// (cac ham assert nem AppError tieng Viet khong dau).

import { prisma } from '../../../../config/prisma';
import { AppError } from '../../../../utils/AppError';
import { assertBoardAccess, isBoardParticipant } from '../../../board/board.service';
import { assertCardAccess } from '../../../card/card.service';
import type { GuardVerdict, StoredOp } from './actions.types';

const NO_CHANGE = 'Chưa thay đổi gì.';

const fail = (code: Extract<GuardVerdict, { ok: false }>['code'], text: string): GuardVerdict => ({ ok: false, code, text });

/** AppError cua service/assert -> loi co ma. Loi 5xx / khong phai AppError duoc nem lai (khong nuot loi he thong). */
export function mapServiceError(e: unknown): Extract<GuardVerdict, { ok: false }> {
  if (e instanceof AppError && e.statusCode === 403) {
    return { ok: false, code: 'FORBIDDEN', text: `Bạn chỉ có quyền xem (hoặc không còn quyền sửa) bảng này nên không thể thay đổi. ${NO_CHANGE}` };
  }
  if (e instanceof AppError && e.statusCode === 404) {
    return { ok: false, code: 'NOT_FOUND', text: `Không tìm thấy thẻ, cột hoặc bảng này (có thể đã bị xoá hoặc lưu trữ). ${NO_CHANGE}` };
  }
  if (e instanceof AppError && e.statusCode < 500) {
    return { ok: false, code: 'INVALID', text: `Không thực hiện được: ${e.message}. ${NO_CHANGE}` };
  }
  throw e;
}

async function attempt(fn: () => Promise<unknown>): Promise<GuardVerdict> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    return mapServiceError(e);
  }
}

async function liveList(boardId: string, listId: string | undefined) {
  if (listId === undefined) return null;
  return prisma.list.findFirst({ where: { id: listId, boardId, deletedAt: null, archivedAt: null }, select: { id: true } });
}

export async function guardOp(args: { userId: string; boardId: string; op: StoredOp }): Promise<GuardVerdict> {
  const { userId, boardId, op } = args;

  const active = await prisma.user.count({ where: { id: userId, deletedAt: null } });
  if (active === 0) return fail('FORBIDDEN', 'Tài khoản không còn hoạt động.');

  // quyen SUA bang (VIEWER / nguoi ngoai bi chan o day)
  const board = await attempt(() => assertBoardAccess(userId, boardId));
  if (!board.ok) return board;

  if (op.type === 'CREATE_CARD') {
    if (!(await liveList(boardId, op.ids.list))) return fail('NOT_FOUND', `Cột này không còn trong bảng. ${NO_CHANGE}`);
    const title = op.params.title ?? '';
    if (title.trim() === '' || title.length > 500) return fail('INVALID', `Tiêu đề thẻ phải từ 1 đến 500 ký tự. ${NO_CHANGE}`);
    return { ok: true };
  }

  // moi thao tac con lai nham vao MOT the
  const cardId = op.ids.card;
  if (cardId === undefined) return fail('INVALID', `Thiếu thẻ cần thao tác. ${NO_CHANGE}`);
  let cardBoardId: string;
  try {
    const card = await assertCardAccess(userId, cardId);
    cardBoardId = card.list.boardId;
  } catch (e) {
    return mapServiceError(e);
  }
  // the phai thuoc DUNG bang cua ke hoach (mot ke hoach chi cham mot bang)
  if (cardBoardId !== boardId) return fail('OUT_OF_SCOPE', `Thẻ này không thuộc bảng của kế hoạch. ${NO_CHANGE}`);

  switch (op.type) {
    case 'RENAME_CARD': {
      const title = op.params.title ?? '';
      return title.trim() === '' || title.length > 500 ? fail('INVALID', `Tiêu đề thẻ phải từ 1 đến 500 ký tự. ${NO_CHANGE}`) : { ok: true };
    }
    case 'MOVE_CARD': {
      // cot dich phai con song va CUNG bang: cam chuyen xuyen bang (moveCard cho phep, chatbot thi khong)
      if (!(await liveList(boardId, op.ids.list))) {
        return fail('OUT_OF_SCOPE', `Cột đích không thuộc bảng này (trợ lý không chuyển thẻ sang bảng khác). ${NO_CHANGE}`);
      }
      return { ok: true };
    }
    case 'ASSIGN_MEMBER': {
      const memberId = op.ids.member;
      if (memberId === undefined) return fail('INVALID', `Thiếu người cần giao. ${NO_CHANGE}`);
      const person = await prisma.user.findFirst({ where: { id: memberId, deletedAt: null }, select: { name: true } });
      if (!person) return fail('NOT_FOUND', `Người này không còn tài khoản hoạt động. ${NO_CHANGE}`);
      if (await isBoardParticipant(boardId, memberId)) return { ok: true };
      const membership = await prisma.boardMember.findFirst({ where: { boardId, userId: memberId, deletedAt: null }, select: { role: true } });
      return membership?.role === 'VIEWER'
        ? fail('VIEWER_ASSIGN', `${person.name} chỉ có quyền xem bảng này nên không giao việc được. ${NO_CHANGE}`)
        : fail('FORBIDDEN', `${person.name} không thuộc bảng này nên không giao việc được. ${NO_CHANGE}`);
    }
    case 'ADD_LABEL': {
      const label = op.ids.label ? await prisma.label.findFirst({ where: { id: op.ids.label, boardId }, select: { id: true } }) : null;
      return label ? { ok: true } : fail('NOT_FOUND', `Nhãn này không thuộc bảng. ${NO_CHANGE}`);
    }
    case 'SET_CARD_DUE':
    case 'SET_CARD_STATUS':
      return { ok: true };
    default:
      return fail('INVALID', `Thao tác không hợp lệ. ${NO_CHANGE}`);
  }
}
