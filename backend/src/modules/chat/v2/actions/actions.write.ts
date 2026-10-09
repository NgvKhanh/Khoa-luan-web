// HAM GHI TRONG TRANSACTION cho tung thao tac (CHATBOT_V2_ACTIONS_PLAN.md, Phase 2; quyet dinh D2: KHONG refactor service cu sang nhan `tx`).
//
// Service ghi cua giao dien (createCard, updateCard, moveCard, addCardMember, attachLabel...) tu ghi Activity, gui thong bao, chay tu dong
// hoa va phat socket NGAY GIUA CHUNG, lai dung `prisma` toan cuc - khong the bao vao mot transaction. Nen ke hoach nhieu thao tac dung bo
// ham rieng o day: moi ham nhan `tx`, CHI ghi CSDL (du lieu + Activity, de rollback thi mat het), va GOM thong bao / tu dong hoa / socket
// vao `Effects` de phat SAU commit (actions.effects). Hanh vi ghi PHAI GIONG HET thao tac tay (cung cot, cung vi tri, cung loai Activity,
// cung noi dung, cung dieu kien gui thong bao); test chat.actions.parity chay cung viec bang service that va bang ham o day roi so sanh.
//
// Hai pha (nguoi goi: actions.executor):
//   lockAndVerify : khoa dong theo thu tu id (khong deadlock), kiem lai quyen + ton tai + gia tri cu. Sai -> PlanAbort -> rollback.
//   applyOp       : ghi tung thao tac theo thu tu da sap xep topo.

import { Prisma } from '../../../../generated/prisma/client';
import type { CardStatus } from '../../../../generated/prisma/enums';
import { initialStatusData, statusWrite } from '../../../card/cardStatus';
import { findPatchCollision } from './actions.patch.build';
import { summarizeExecuted } from './actions.plan';
import { findSameRule } from './actions.rule';
import type { Effects } from './actions.effects';
import type { ActionErrorCode, StoredOp } from './actions.types';

export type Tx = Prisma.TransactionClient;

/** Dung tien trinh ghi VA hoan tac toan bo transaction. `code` quyet dinh trang thai ket qua (STALE / FORBIDDEN...). */
export class PlanAbort extends Error {
  constructor(
    public readonly code: ActionErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'PlanAbort';
  }
}

export interface WriteContext {
  userId: string;
  boardId: string;
  /** Board Patch: khoa ca bang va kiem trung cot / the ngay trong transaction (nguoi khac co the vua them sau luc xem truoc). */
  patch?: boolean;
}

interface CardState {
  id: string;
  title: string;
  dueDate: Date | null;
  status: CardStatus;
  listId: string;
  listName: string;
  /** Trang thai cua COT dang chua the (null = cot tu do). */
  listStatus: CardStatus | null;
}

export interface CreatedEntity {
  key: string;
  id: string;
  kind: 'LIST' | 'CARD';
  name: string;
}

export interface RunState {
  created: Map<string, CreatedEntity>;
  cards: Map<string, CardState>;
  /** Moc thoi gian Activity cuoi (de cac dong trong cung ke hoach co thu tu strictly tang). */
  lastActivityMs: number;
}

export const newRunState = (): RunState => ({ created: new Map(), cards: new Map(), lastActivityMs: 0 });

export interface OpOutcome {
  index: number;
  text: string;
  /** false: thao tac da dung roi (noop) hoac khong doi gi. */
  changed: boolean;
  cardId?: string;
  listId?: string;
}

const unique = <T>(xs: readonly T[]): T[] => [...new Set(xs)];

// ---------------------------------------------------------------------------------------------------------------------
// Quyen trong transaction
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Nguoi dung co SUA duoc bang khong - doc trong CUNG transaction (dong bo voi du lieu dang ghi). Cung luat voi assertBoardAccess va
 * isBoardParticipant (hai ham do cho ket qua giong nhau): chu bang; thanh vien bang vai tro khac VIEWER; neu khong co membership thi thanh
 * vien khong gian khi bang o muc WORKSPACE. Dung cho CA nguoi ra lenh LAN nguoi duoc giao.
 */
export async function canEditInTx(tx: Tx, boardId: string, userId: string): Promise<boolean> {
  if ((await tx.user.count({ where: { id: userId, deletedAt: null } })) === 0) return false;
  const board = await tx.board.findFirst({ where: { id: boardId, deletedAt: null, archivedAt: null }, select: { ownerId: true, visibility: true, workspaceId: true } });
  if (!board) return false;
  if (board.ownerId === userId) return true;
  const membership = await tx.boardMember.findFirst({ where: { boardId, userId, deletedAt: null }, select: { role: true } });
  if (membership) return membership.role !== 'VIEWER';
  if (board.visibility !== 'WORKSPACE') return false;
  const ws = await tx.workspace.findFirst({ where: { id: board.workspaceId, deletedAt: null }, select: { ownerId: true } });
  if (!ws) return false;
  if (ws.ownerId === userId) return true;
  return (await tx.workspaceMember.count({ where: { workspaceId: board.workspaceId, userId, deletedAt: null } })) > 0;
}

// ---------------------------------------------------------------------------------------------------------------------
// Pha 1: khoa + kiem tra lai
// ---------------------------------------------------------------------------------------------------------------------

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

/** Kiem tra lai moi dieu kien TRONG transaction, sau khi khoa dong. Thieu mot dieu kien -> PlanAbort (rollback, khong ghi gi). */
export async function lockAndVerify(tx: Tx, ctx: WriteContext, ops: readonly StoredOp[]): Promise<RunState> {
  const state = newRunState();
  const board = await tx.board.findFirst({ where: { id: ctx.boardId, deletedAt: null, archivedAt: null }, select: { id: true } });
  if (!board) throw new PlanAbort('STALE', 'Bảng không còn tồn tại.');
  if (!(await canEditInTx(tx, ctx.boardId, ctx.userId))) throw new PlanAbort('FORBIDDEN', 'Bạn không còn quyền sửa bảng này.');

  // Board Patch: khoa dong bang TRUOC (thu tu khoa co dinh: bang -> cot -> the) de hai Board Patch dong thoi tren cung bang khong cung tao mot cot / the
  // Phase 7: tao luat cung khoa dong bang (hai lenh tao cung mot luat dong thoi chi mot cai thanh cong; cai kia thay luat da co)
  const newRules = ops.filter((o) => o.type === 'CREATE_AUTOMATION_RULE' && o.noop === undefined);
  if (ctx.patch === true || newRules.length > 0) await tx.$queryRaw`SELECT id FROM "Board" WHERE id = ${ctx.boardId} FOR UPDATE`;

  const cardIds = unique(ops.flatMap((o) => (o.ids.card !== undefined ? [o.ids.card] : [])));
  const listIds = unique(ops.flatMap((o) => (o.ids.list !== undefined ? [o.ids.list] : [])));
  const ruleActions = (o: StoredOp) => o.params.rule?.actions ?? [];
  const labelIds = unique(ops.flatMap((o) => [...(o.ids.label !== undefined ? [o.ids.label] : []), ...ruleActions(o).flatMap((a) => (a.labelId !== undefined ? [a.labelId] : []))]));
  const memberIds = unique(ops.flatMap((o) => [...(o.ids.member !== undefined ? [o.ids.member] : []), ...ruleActions(o).flatMap((a) => (a.userId !== undefined ? [a.userId] : []))]));

  // Khoa theo THU TU CO DINH (cot truoc, the sau, trong moi nhom theo id) de hai ke hoach dong thoi khong khoa cheo nhau (deadlock).
  // Cot nguon cua cac the (se bi danh lai vi tri khi the roi di) cung phai khoa -> doc cot hien tai cua the truoc khi khoa.
  const sourceLists = cardIds.length === 0 ? [] : (await tx.card.findMany({ where: { id: { in: cardIds } }, select: { listId: true } })).map((c) => c.listId);
  const lockLists = unique([...listIds, ...sourceLists]).sort();
  if (lockLists.length > 0) await tx.$queryRaw`SELECT id FROM "List" WHERE id IN (${Prisma.join(lockLists)}) ORDER BY id FOR UPDATE`;
  if (cardIds.length > 0) await tx.$queryRaw`SELECT id FROM "Card" WHERE id IN (${Prisma.join([...cardIds].sort())}) ORDER BY id FOR UPDATE`;

  if (listIds.length > 0) {
    const alive = await tx.list.count({ where: { id: { in: listIds }, boardId: ctx.boardId, deletedAt: null, archivedAt: null } });
    if (alive !== listIds.length) throw new PlanAbort('STALE', 'Một cột trong kế hoạch không còn trong bảng.');
  }
  if (ctx.patch === true) {
    const lists = await tx.list.findMany({ where: { boardId: ctx.boardId, deletedAt: null, archivedAt: null }, select: { id: true, name: true } });
    const cards = await tx.card.findMany({ where: { listId: { in: lists.map((l) => l.id) }, deletedAt: null, archivedAt: null }, select: { listId: true, title: true } });
    const collision = findPatchCollision(ops, { lists, cards });
    if (collision !== null) throw new PlanAbort('STALE', collision);
  }
  if (labelIds.length > 0) {
    const alive = await tx.label.count({ where: { id: { in: labelIds }, boardId: ctx.boardId } });
    if (alive !== labelIds.length) throw new PlanAbort('STALE', 'Một nhãn trong kế hoạch không còn thuộc bảng.');
  }
  for (const memberId of memberIds) {
    if (!(await canEditInTx(tx, ctx.boardId, memberId))) throw new PlanAbort('STALE', 'Một người được giao không còn là thành viên của bảng.');
  }

  for (const o of newRules) {
    const rule = o.params.rule;
    if (rule === undefined) throw new PlanAbort('INVALID', 'Luật không có nội dung.');
    const same = await findSameRule(tx, ctx.boardId, { trigger: rule.trigger, listId: o.ids.list ?? null, actions: rule.actions });
    if (same !== null) throw new PlanAbort('STALE', 'Một luật giống hệt vừa được tạo kể từ lúc xem trước.');
  }

  if (cardIds.length > 0) {
    const rows = await tx.card.findMany({
      where: { id: { in: cardIds }, deletedAt: null, archivedAt: null },
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        listId: true,
        list: { select: { id: true, name: true, status: true, boardId: true } },
        members: { select: { userId: true } },
        labels: { select: { labelId: true } },
      },
    });
    if (rows.length !== cardIds.length) throw new PlanAbort('STALE', 'Một thẻ trong kế hoạch không còn tồn tại.');
    const byId = new Map(rows.map((r) => [r.id, r]));
    for (const row of rows) {
      if (row.list.boardId !== ctx.boardId) throw new PlanAbort('STALE', 'Một thẻ trong kế hoạch đã được chuyển sang bảng khác.');
      state.cards.set(row.id, { id: row.id, title: row.title, dueDate: row.dueDate, status: row.status, listId: row.listId, listName: row.list.name, listStatus: row.list.status });
    }
    // gia tri cu: so voi TRANG THAI BAN DAU (truoc khi thao tac nao cua ke hoach chay)
    for (const op of ops) {
      const row = op.ids.card !== undefined ? byId.get(op.ids.card) : undefined;
      if (!row || op.before === null) continue;
      const b = op.before;
      const bad =
        (op.type === 'RENAME_CARD' && row.title !== b.title) ||
        (op.type === 'SET_CARD_DUE' && iso(row.dueDate) !== (b.due ?? null)) ||
        (op.type === 'MOVE_CARD' && row.listId !== b.listId) ||
        (op.type === 'SET_CARD_STATUS' && row.status !== b.status) ||
        (op.type === 'ASSIGN_MEMBER' && row.members.some((m) => m.userId === op.ids.member) !== (b.alreadyAssigned ?? false)) ||
        (op.type === 'ADD_LABEL' && row.labels.some((l) => l.labelId === op.ids.label) !== (b.alreadyLabeled ?? false));
      if (bad) throw new PlanAbort('STALE', 'Dữ liệu của thẻ đã thay đổi kể từ lúc xem trước.');
    }
  }
  return state;
}

// ---------------------------------------------------------------------------------------------------------------------
// Pha 2: ghi
// ---------------------------------------------------------------------------------------------------------------------

/** Ghi mot dong Activity TRONG transaction. Thoi gian tang dan nghiem ngat de lich su hien dung thu tu thao tac. */
async function record(tx: Tx, ctx: WriteContext, state: RunState, effects: Effects, input: { cardId: string | null; type: string; data: Record<string, unknown> }): Promise<void> {
  state.lastActivityMs = Math.max(Date.now(), state.lastActivityMs + 1);
  await tx.activity.create({
    data: { boardId: ctx.boardId, cardId: input.cardId, userId: ctx.userId, type: input.type, data: input.data as object, createdAt: new Date(state.lastActivityMs) },
  });
  effects.activities.push({ type: input.type, cardId: input.cardId });
}

/** Loai Activity cho mot lan doi trang thai (giong logStatusChange): vao DONE = card.done, roi DONE = card.undone, con lai card.status. */
const statusActivityType = (from: CardStatus, to: CardStatus): string => (to === 'DONE' ? 'card.done' : from === 'DONE' ? 'card.undone' : 'card.status');

function cardOf(state: RunState, op: StoredOp): CardState {
  const id = op.ids.card ?? (op.local?.card !== undefined ? state.created.get(op.local.card)?.id : undefined);
  const card = id !== undefined ? state.cards.get(id) : undefined;
  if (!card) throw new PlanAbort('INVALID', 'Thao tác nhắc tới một thẻ không có trong kế hoạch.');
  return card;
}

function listIdOf(state: RunState, op: StoredOp): string {
  const id = op.ids.list ?? (op.local?.list !== undefined ? state.created.get(op.local.list)?.id : undefined);
  if (id === undefined) throw new PlanAbort('INVALID', 'Thao tác nhắc tới một cột không có trong kế hoạch.');
  return id;
}

/** Vi tri ke tiep o cuoi cot (giong createCard / createList). */
async function nextCardPosition(tx: Tx, listId: string): Promise<number> {
  const last = await tx.card.findFirst({ where: { listId, deletedAt: null, archivedAt: null }, orderBy: { position: 'desc' }, select: { position: true } });
  return last ? last.position + 1 : 0;
}

interface MoveResult {
  moved: boolean;
  statusChanged: boolean;
}

/**
 * Chuyen the sang cot `target` (cung bang), chen vao `position` (nhu moveCard): danh lai vi tri cot dich, doi trang thai theo cot dich,
 * danh lai vi tri cot nguon, ghi Activity, gom thong bao "card.moved" + tu dong hoa. `notifyDone`: gui "da hoan thanh" khi the vao DONE
 * (chi khi goi tu viec doi trang thai bang tay, nhu updateCard).
 */
async function moveWithin(
  tx: Tx,
  ctx: WriteContext,
  state: RunState,
  effects: Effects,
  excl: (cardId: string) => string[],
  card: CardState,
  target: { id: string; name: string; status: CardStatus | null },
  position: number,
  notifyDone: boolean
): Promise<MoveResult> {
  const sourceId = card.listId;
  const sourceName = card.listName;
  const targetCards = await tx.card.findMany({
    where: { listId: target.id, deletedAt: null, archivedAt: null, id: { not: card.id } },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  const index = Math.min(Math.max(position, 0), targetCards.length);
  const orderedIds = [...targetCards.slice(0, index).map((c) => c.id), card.id, ...targetCards.slice(index).map((c) => c.id)];
  for (const [i, id] of orderedIds.entries()) {
    await tx.card.update({ where: { id }, data: id === card.id ? { position: i, listId: target.id } : { position: i } });
  }

  const changedList = sourceId !== target.id;
  let statusChanged = false;
  const fromStatus = card.status;
  if (changedList) {
    if (target.status) statusChanged = (await statusWrite(tx, { id: card.id }, target.status)).count > 0;
    const remaining = await tx.card.findMany({
      where: { listId: sourceId, deletedAt: null, archivedAt: null, id: { not: card.id } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    for (const [i, c] of remaining.entries()) await tx.card.update({ where: { id: c.id }, data: { position: i } });

    await record(tx, ctx, state, effects, { cardId: card.id, type: 'card.move', data: { fromList: sourceName, toList: target.name } });
    if (statusChanged && target.status) {
      await record(tx, ctx, state, effects, { cardId: card.id, type: statusActivityType(fromStatus, target.status), data: { from: fromStatus, to: target.status } });
      if (notifyDone && target.status === 'DONE') {
        effects.notifications.push({ type: 'card.marked.done', actorId: ctx.userId, boardId: ctx.boardId, cardId: card.id, data: { cardTitle: card.title }, to: { kind: 'MEMBERS', cardId: card.id, exclude: excl(card.id) } });
      }
    }
    effects.notifications.push({
      type: 'card.moved',
      actorId: ctx.userId,
      boardId: ctx.boardId,
      cardId: card.id,
      data: { cardTitle: card.title, toList: target.name },
      to: { kind: 'MEMBERS', cardId: card.id, exclude: excl(card.id) },
    });
    effects.automations.push({ trigger: 'CARD_MOVED_TO_LIST', cardId: card.id, cardTitle: card.title, boardId: ctx.boardId, listId: target.id });
    card.listId = target.id;
    card.listName = target.name;
    card.listStatus = target.status;
    if (statusChanged && target.status) card.status = target.status;
  }
  effects.boardIds.add(ctx.boardId);
  return { moved: changedList, statusChanged };
}

/**
 * Ghi MOT thao tac trong transaction. `excl(cardId)` = nhung nguoi se duoc giao the nay o thao tac SAU (de thong bao cua thao tac
 * truoc khong gui cho ho - dung nhu khi nguoi dung lam tay theo thu tu).
 */
export async function applyOp(tx: Tx, ctx: WriteContext, state: RunState, effects: Effects, op: StoredOp, index: number, excl: (cardId: string) => string[]): Promise<OpOutcome> {
  // da dung roi luc xem truoc (va lockAndVerify vua xac nhan van dung) -> khong ghi gi
  if (op.noop !== undefined) return { index, text: op.noop, changed: false, ...(op.ids.card !== undefined ? { cardId: op.ids.card } : {}) };
  const boardId = ctx.boardId;

  switch (op.type) {
    case 'CREATE_LIST': {
      const last = await tx.list.findFirst({ where: { boardId, deletedAt: null, archivedAt: null }, orderBy: { position: 'desc' }, select: { position: true } });
      const name = op.params.name as string;
      const list = await tx.list.create({ data: { boardId, name, position: last ? last.position + 1 : 0, status: op.params.listStatus ?? null } });
      // thao tac tay (createList) khong ghi Activity, chi bao realtime
      effects.boardIds.add(boardId);
      if (op.key !== undefined) state.created.set(op.key, { key: op.key, id: list.id, kind: 'LIST', name });
      return { index, text: summarizeExecuted(op), changed: true, listId: list.id };
    }
    case 'CREATE_CARD': {
      const listId = listIdOf(state, op);
      const list = await tx.list.findFirst({ where: { id: listId, boardId, deletedAt: null, archivedAt: null }, select: { id: true, name: true, status: true } });
      if (!list) throw new PlanAbort('STALE', 'Cột để tạo thẻ không còn trong bảng.');
      const title = op.params.title as string;
      const card = await tx.card.create({ data: { listId, title, position: await nextCardPosition(tx, listId), ...initialStatusData(list.status) } });
      await record(tx, ctx, state, effects, { cardId: card.id, type: 'card.create', data: { listName: list.name } });
      effects.automations.push({ trigger: 'CARD_CREATED', cardId: card.id, cardTitle: card.title, boardId, listId });
      effects.boardIds.add(boardId);
      state.cards.set(card.id, { id: card.id, title: card.title, dueDate: null, status: card.status, listId, listName: list.name, listStatus: list.status });
      if (op.key !== undefined) state.created.set(op.key, { key: op.key, id: card.id, kind: 'CARD', name: card.title });
      return { index, text: summarizeExecuted(op, { createdTitle: card.title }), changed: true, cardId: card.id, listId };
    }
    case 'RENAME_CARD': {
      const card = cardOf(state, op);
      const title = op.params.title as string;
      const previous = card.title;
      await tx.card.update({ where: { id: card.id }, data: { title } });
      if (title !== previous) {
        await record(tx, ctx, state, effects, { cardId: card.id, type: 'card.rename', data: { from: previous, to: title } });
        effects.notifications.push({ type: 'card.renamed', actorId: ctx.userId, boardId, cardId: card.id, data: { cardTitle: title }, to: { kind: 'MEMBERS', cardId: card.id, exclude: excl(card.id) } });
      }
      card.title = title;
      effects.boardIds.add(boardId);
      return { index, text: summarizeExecuted({ ...op, before: { title: previous } }), changed: title !== previous, cardId: card.id };
    }
    case 'SET_CARD_DUE': {
      const card = cardOf(state, op);
      const to = op.params.due ?? null;
      const from = iso(card.dueDate);
      await tx.card.update({ where: { id: card.id }, data: { dueDate: to ? new Date(to) : null } });
      // dat lai nhac han (hoac xoa) khi doi han - giong resetCardRemindersOnDueDateChange
      if (to) await tx.cardReminder.updateMany({ where: { cardId: card.id }, data: { sentAt: null } });
      else await tx.cardReminder.deleteMany({ where: { cardId: card.id } });
      if (from !== to) {
        await record(tx, ctx, state, effects, { cardId: card.id, type: to ? 'card.due.set' : 'card.due.clear', data: { from, to, ...(to ? { dueDate: to } : {}) } });
        if (to) effects.notifications.push({ type: 'card.due.set', actorId: ctx.userId, boardId, cardId: card.id, data: { cardTitle: card.title, dueDate: to }, to: { kind: 'MEMBERS', cardId: card.id, exclude: excl(card.id) } });
      }
      card.dueDate = to ? new Date(to) : null;
      effects.boardIds.add(boardId);
      return { index, text: summarizeExecuted(op), changed: from !== to, cardId: card.id };
    }
    case 'MOVE_CARD': {
      const card = cardOf(state, op);
      const listId = listIdOf(state, op);
      const target = await tx.list.findFirst({ where: { id: listId, boardId, deletedAt: null, archivedAt: null }, select: { id: true, name: true, status: true } });
      if (!target) throw new PlanAbort('STALE', 'Cột đích không còn trong bảng.');
      // cuoi cot: dem the con lai (nhu Phase 1)
      const position = await tx.card.count({ where: { listId, deletedAt: null, archivedAt: null, id: { not: card.id } } });
      const from = card.listName;
      const moved = await moveWithin(tx, ctx, state, effects, excl, card, target, position, false);
      return { index, text: summarizeExecuted({ ...op, before: { ...(op.before ?? {}), listName: op.before?.listName ?? from } }), changed: moved.moved, cardId: card.id, listId };
    }
    case 'SET_CARD_STATUS': {
      const card = cardOf(state, op);
      const to = op.params.status as CardStatus;
      const from = card.status;
      let movedTo: string | undefined;
      if (from !== to) {
        // lien ket hai chieu (nhu updateCard): the dang o cot CO trang thai khac -> chuyen sang dau cot mang trang thai moi cua bang
        const moveTo =
          card.listStatus !== null && card.listStatus !== to
            ? await tx.list.findFirst({ where: { boardId, status: to, deletedAt: null, archivedAt: null }, orderBy: [{ position: 'asc' }, { createdAt: 'asc' }], select: { id: true, name: true, status: true } })
            : null;
        if (moveTo) {
          const before = card.listId;
          await moveWithin(tx, ctx, state, effects, excl, card, moveTo, 0, true);
          if (moveTo.id !== before) movedTo = moveTo.name;
        } else if ((await statusWrite(tx, { id: card.id }, to)).count > 0) {
          await record(tx, ctx, state, effects, { cardId: card.id, type: statusActivityType(from, to), data: { from, to } });
          if (to === 'DONE') effects.notifications.push({ type: 'card.marked.done', actorId: ctx.userId, boardId, cardId: card.id, data: { cardTitle: card.title }, to: { kind: 'MEMBERS', cardId: card.id, exclude: excl(card.id) } });
          card.status = to;
        }
      }
      effects.boardIds.add(boardId);
      return { index, text: summarizeExecuted(op, movedTo !== undefined ? { movedTo } : {}), changed: from !== to, cardId: card.id };
    }
    case 'ASSIGN_MEMBER': {
      const card = cardOf(state, op);
      const memberId = op.ids.member as string;
      const inserted = await tx.cardMember.createMany({ data: { cardId: card.id, userId: memberId, assignedById: ctx.userId }, skipDuplicates: true });
      if (inserted.count > 0) {
        const user = await tx.user.findUniqueOrThrow({ where: { id: memberId }, select: { name: true } });
        await record(tx, ctx, state, effects, { cardId: card.id, type: 'member.add', data: { memberId, memberName: user.name } });
        effects.notifications.push({ type: 'card.member.added', actorId: ctx.userId, boardId, cardId: card.id, data: { cardTitle: card.title }, to: { kind: 'USERS', ids: [memberId] } });
      }
      effects.boardIds.add(boardId);
      return { index, text: summarizeExecuted(op), changed: inserted.count > 0, cardId: card.id };
    }
    case 'CREATE_AUTOMATION_RULE': {
      // giong createAutomationRule: ghi luat + cac hanh dong theo thu tu; khong ghi Activity, khong co realtime (bang Tu dong hoa tai khi mo)
      const rule = op.params.rule;
      if (rule === undefined) throw new PlanAbort('INVALID', 'Luật không có nội dung.');
      await tx.automationRule.create({
        data: {
          boardId,
          createdById: ctx.userId,
          name: rule.name,
          isEnabled: true,
          triggerType: rule.trigger,
          triggerListId: op.ids.list ?? null,
          actions: {
            create: rule.actions.map((a, i) => ({ position: i, type: a.type, boolValue: a.type === 'SET_DONE' ? (a.done ?? true) : null, labelId: a.labelId ?? null, userId: a.userId ?? null })),
          },
        },
      });
      return { index, text: summarizeExecuted(op), changed: true };
    }
    case 'ADD_LABEL': {
      const card = cardOf(state, op);
      const labelId = op.ids.label as string;
      await tx.cardLabel.upsert({ where: { cardId_labelId: { cardId: card.id, labelId } }, create: { cardId: card.id, labelId }, update: {} });
      effects.boardIds.add(boardId);
      return { index, text: summarizeExecuted(op), changed: true, cardId: card.id };
    }
  }
}

/**
 * Voi moi chi so thao tac: nhung ai se duoc giao the nay o cac thao tac SAU (va chua la thanh vien luc xem truoc). Thong bao cua thao
 * tac truoc khong gui cho ho - dung nhu khi nguoi dung lam tay theo thu tu. The do ke hoach tao ra duoc nhan dien qua `state.created`.
 */
export function laterAssignees(ops: readonly StoredOp[], state: RunState): (index: number) => (cardId: string) => string[] {
  const cardIdOf = (op: StoredOp): string | undefined => op.ids.card ?? (op.local?.card !== undefined ? state.created.get(op.local.card)?.id : undefined);
  return (index) => (cardId) => {
    const out: string[] = [];
    for (const [j, op] of ops.entries()) {
      if (j <= index || op.type !== 'ASSIGN_MEMBER' || op.noop !== undefined || op.ids.member === undefined) continue;
      if (cardIdOf(op) === cardId) out.push(op.ids.member);
    }
    return out;
  };
}
