// THUC THI mot ke hoach da NHAN CHO (status EXECUTING) - CHATBOT_V2_ACTIONS_PLAN.md §4.6 "ServiceStrategy".
//
// Phase 1: moi ke hoach DUNG MOT thao tac nen goi THANG service ma giao dien dang dung (createCard, updateCard, moveCard,
// addCardMember, attachLabel), voi `userId` cua chinh nguoi dung -> hanh vi GIONG HET thao tac tay: cung kiem quyen, cung nhat ky
// Activity, cung thong bao, cung tu dong hoa, cung su kien socket. Executor KHONG tu ghi CSDL, KHONG tu phat socket.
//
// Truoc khi goi: kiem lai quyen + nghiep vu (guard), kiem TIEN DIEU KIEN (gia tri cu van dung nhu luc xem truoc - neu khong thi
// STALE, khong ghi de thay doi moi cua nguoi khac). Mot loi service khong lam ke hoach treo o EXECUTING: luon chot FAILED / STALE.

import { prisma } from '../../../../config/prisma';
import type { Prisma } from '../../../../generated/prisma/client';
import { createCard, moveCard, updateCard } from '../../../card/card.service';
import { addCardMember } from '../../../card/cardExtras.service';
import { attachLabel } from '../../../label/label.service';
import { guardOp, mapServiceError } from './actions.guard';
import { buildResultView, errorText, summarizeExecuted } from './actions.plan';
import { updatePlan, type PlanRow } from './actions.plan.repo';
import type { ActionErrorCode, ResultStatus, ResultView, StoredOp, StoredPlan } from './actions.types';

export interface ExecOutcome {
  status: ResultStatus;
  result: ResultView;
}

interface ServiceEffect {
  cardId?: string;
  createdTitle?: string;
  movedTo?: string;
}

const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

/** Gia tri hien tai co con DUNG nhu luc xem truoc khong? Tra ve cau giai thich neu khong (-> STALE). */
async function staleReason(op: StoredOp): Promise<string | null> {
  const cardId = op.ids.card;
  if (cardId === undefined || op.before === null) return null;
  const card = await prisma.card.findFirst({
    where: { id: cardId, deletedAt: null, archivedAt: null },
    select: { title: true, dueDate: true, listId: true, status: true },
  });
  if (!card) return 'Thẻ không còn tồn tại.';
  switch (op.type) {
    case 'RENAME_CARD':
      return card.title === op.before.title ? null : 'Thẻ đã được đổi tên kể từ lúc xem trước.';
    case 'SET_CARD_DUE':
      return (card.dueDate?.toISOString() ?? null) === (op.before.due ?? null) ? null : 'Hạn của thẻ đã thay đổi kể từ lúc xem trước.';
    case 'MOVE_CARD':
      return card.listId === op.before.listId ? null : 'Thẻ đã được chuyển sang cột khác kể từ lúc xem trước.';
    case 'SET_CARD_STATUS':
      return card.status === op.before.status ? null : 'Trạng thái của thẻ đã thay đổi kể từ lúc xem trước.';
    default:
      return null;
  }
}

/** Goi dung service cua thao tac. Nem lai moi loi (nguoi goi map thanh ma loi). */
async function callService(userId: string, op: StoredOp): Promise<ServiceEffect> {
  const cardId = op.ids.card;
  switch (op.type) {
    case 'CREATE_CARD': {
      const card = await createCard(userId, op.ids.list as string, { title: op.params.title as string });
      return { cardId: card.id, createdTitle: card.title };
    }
    case 'RENAME_CARD':
      await updateCard(userId, cardId as string, { title: op.params.title as string });
      return { cardId };
    case 'SET_CARD_DUE':
      await updateCard(userId, cardId as string, { dueDate: op.params.due ?? null });
      return { cardId };
    case 'MOVE_CARD': {
      const listId = op.ids.list as string;
      // cuoi cot: dem the con lai (moveCard tu kep vi tri ve [0, so the])
      const position = await prisma.card.count({ where: { listId, deletedAt: null, archivedAt: null, id: { not: cardId } } });
      await moveCard(userId, cardId as string, { listId, position });
      return { cardId };
    }
    case 'SET_CARD_STATUS': {
      await updateCard(userId, cardId as string, { status: op.params.status });
      // doi trang thai co the keo the sang cot mang trang thai do (quy tac hai chieu cua updateCard)
      const after = await prisma.card.findUnique({ where: { id: cardId as string }, select: { list: { select: { id: true, name: true } } } });
      return { cardId, movedTo: after && after.list.id !== op.before?.listId ? after.list.name : undefined };
    }
    case 'ASSIGN_MEMBER':
      await addCardMember(userId, cardId as string, op.ids.member as string);
      return { cardId };
    case 'ADD_LABEL':
      await attachLabel(userId, cardId as string, op.ids.label as string);
      return { cardId };
  }
}

/**
 * Chay ke hoach da nhan cho va CHOT trang thai (EXECUTED / FAILED / STALE) vao bang. `row.status` phai la EXECUTING (claimPlan).
 */
export async function runClaimedPlan(row: PlanRow, now: Date, autoExecuted: boolean): Promise<ExecOutcome> {
  const stored = row.plan as unknown as StoredPlan;
  const op = stored.ops[0];
  const userId = row.userId as string;
  const base = { planId: row.id, autoExecuted, boardId: stored.boardId, cardId: op.ids.card };

  const settle = async (
    status: ResultStatus,
    summary: string,
    extra: { code?: ActionErrorCode; detail?: string; cardId?: string; executedOps?: number } = {}
  ): Promise<ExecOutcome> => {
    const result = buildResultView({
      ...base,
      ...(extra.cardId !== undefined ? { cardId: extra.cardId } : {}),
      status,
      summary,
      ...(extra.code !== undefined ? { error: { code: extra.code, text: summary } } : {}),
      warnings: stored.warnings,
    });
    await updatePlan(row.id, {
      status,
      result: json({ ...result, ...(extra.detail !== undefined ? { detail: extra.detail.slice(0, 300) } : {}) }),
      errorCode: extra.code ?? null,
      executedOps: extra.executedOps ?? (status === 'EXECUTED' ? 1 : 0),
      ...(status === 'EXECUTED' ? { executedAt: now } : {}),
    });
    return { status, result };
  };

  try {
    // 1) quyen + nghiep vu, kiem lai DUNG luc chay
    const guard = await guardOp({ userId, boardId: stored.boardId, op });
    if (!guard.ok) {
      const stale = guard.code === 'NOT_FOUND';
      return settle(stale ? 'STALE' : 'FAILED', stale ? errorText('STALE') : guard.text, { code: stale ? 'STALE' : guard.code });
    }
    // 2) gia tri cu con dung khong
    const reason = await staleReason(op);
    if (reason !== null) return settle('STALE', `${reason} ${errorText('STALE')}`, { code: 'STALE' });
    // 3) da dung roi -> khong goi service
    if (op.noop !== undefined) return settle('EXECUTED', op.noop, { executedOps: 0 });
    // 4) goi service that
    const effect = await callService(userId, op);
    return settle('EXECUTED', summarizeExecuted(op, effect), { cardId: effect.cardId });
  } catch (e) {
    try {
      const mapped = mapServiceError(e);
      return await settle('FAILED', mapped.text, { code: mapped.code, detail: e instanceof Error ? e.message : undefined });
    } catch {
      // loi he thong (khong phai AppError < 500): chot FAILED, KHONG de ke hoach treo o EXECUTING, va khong lo chi tiet cho nguoi dung
      return settle('FAILED', errorText('SERVICE_ERROR'), {
        code: 'SERVICE_ERROR',
        detail: e instanceof Error ? `${e.name}: ${e.message}` : 'unknown',
      });
    }
  }
}
