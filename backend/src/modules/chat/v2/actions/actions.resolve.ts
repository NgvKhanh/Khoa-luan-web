// RESOLVER: tham chieu tuong trung (TEXT / CONTEXT / SELF) -> id THAT trong bang cua ke hoach (CHATBOT_V2_ACTIONS_PLAN.md §6, §7).
//
// LLM khong bao gio thay ket qua nay va khong co o nao de dien id. Moi tham chieu tim trong `exec` (da kep boi tran pham vi va
// chi gom DUNG bang cua ke hoach) nen "Login" o bang khac khong bao gio khop. Ket qua moi tham chieu: ONE / MANY (nhap nhang ->
// nut chon) / NONE (khong tim thay, khong goi y bang khac).

import { prisma } from '../../../../config/prisma';
import { guessListStatus } from '../../../card/cardStatus';
import { isSelfReference } from '../../chat.members';
import { liveCardWhere } from '../../chat.scope';
import { resolveEntities, type EntityOption } from '../chat.v2.entities';
import type { ExecutionContext } from '../chat.v2.scope';
import { dueIso, formatDueDate, vnDayOfIso, type DueGrounding } from './actions.dates';
import type { ActionOp, Ref } from './actions.schema';
import { stripLeadingGeneric } from './actions.text';
import type { ActionErrorCode, PendingChoice, StoredOp } from './actions.types';

/** Toi da bay nhieu nut chon; nhieu hon thi bao nguoi dung neu ro hon (khong cat danh sach am tham). */
export const MAX_CHOICES = 8;

export type Presets = Partial<Record<PendingChoice['path'], string>>;

export interface ResolveEnv {
  userId: string;
  exec: ExecutionContext;
  boardId: string;
  /** session.bindings (da kiem lai quyen o dau luot). */
  bindings: readonly EntityOption[];
  /** Chi SET_CARD_DUE: ngay da hieu tu cau cua nguoi dung. */
  due?: DueGrounding;
}

export type ResolveResult =
  | { kind: 'OK'; op: StoredOp; warnings: string[] }
  | { kind: 'CHOICE'; pending: PendingChoice }
  | { kind: 'FAIL'; code: ActionErrorCode; text: string };

interface Hit {
  id: string;
  name: string;
  parentName?: string;
}
type Outcome = { kind: 'ONE'; hit: Hit } | { kind: 'MANY'; hits: Hit[] } | { kind: 'NONE'; text: string };

const WHAT: Record<PendingChoice['path'], string> = { card: 'thẻ', list: 'cột', toList: 'cột', member: 'thành viên', label: 'nhãn' };

function fromOptions(options: readonly EntityOption[], text: string): Outcome {
  if (options.length === 0) return { kind: 'NONE', text };
  const hits = options.map((o) => ({ id: o.id, name: o.name, parentName: o.parentName }));
  return hits.length === 1 ? { kind: 'ONE', hit: hits[0] } : { kind: 'MANY', hits };
}

/** Tim theo ten; khong thay thi thu lai sau khi bo tu chung o dau ("task Login" -> "Login"). */
async function byName(exec: ExecutionContext, kind: EntityOption['kind'], text: string): Promise<Outcome> {
  const first = await resolveEntities(exec, kind, text);
  if (first.status !== 'NOT_FOUND') return fromOptions(first.options, text);
  const stripped = stripLeadingGeneric(text);
  if (stripped !== '' && stripped !== text) {
    const second = await resolveEntities(exec, kind, stripped);
    if (second.status !== 'NOT_FOUND') return fromOptions(second.options, text);
  }
  return { kind: 'NONE', text };
}

const CARD_SELECT = {
  id: true,
  title: true,
  dueDate: true,
  status: true,
  listId: true,
  list: { select: { id: true, name: true, boardId: true } },
  members: { select: { userId: true } },
  labels: { select: { labelId: true } },
} as const;

async function loadCard(env: ResolveEnv, id: string) {
  return prisma.card.findFirst({ where: { AND: [liveCardWhere(env.exec.scope.boardWhere), { id }] }, select: CARD_SELECT });
}

async function loadList(env: ResolveEnv, id: string): Promise<Hit | null> {
  const l = await prisma.list.findFirst({
    where: { id, boardId: env.boardId, deletedAt: null, archivedAt: null },
    select: { id: true, name: true },
  });
  return l ? { id: l.id, name: l.name } : null;
}

function binding(env: ResolveEnv, kind: EntityOption['kind']): EntityOption | undefined {
  return env.bindings.find((b) => b.kind === kind);
}

async function findCard(env: ResolveEnv, ref: Ref, preset?: string): Promise<Outcome> {
  if (preset !== undefined) {
    const c = await loadCard(env, preset);
    return c ? { kind: 'ONE', hit: { id: c.id, name: c.title } } : { kind: 'NONE', text: 'thẻ đã chọn' };
  }
  if (ref.by === 'CONTEXT') {
    const b = binding(env, 'CARD');
    const c = b ? await loadCard(env, b.id) : null;
    return c ? { kind: 'ONE', hit: { id: c.id, name: c.title } } : { kind: 'NONE', text: 'thẻ vừa nhắc' };
  }
  if (ref.by !== 'TEXT') return { kind: 'NONE', text: 'thẻ' };
  const out = await byName(env.exec, 'CARD', ref.text);
  if (out.kind !== 'MANY') return out;
  // phan biet hai the cung ten bang TEN COT chua chung
  const rows = await prisma.card.findMany({ where: { id: { in: out.hits.map((h) => h.id) } }, select: { id: true, list: { select: { name: true } } } });
  const listOf = new Map(rows.map((r) => [r.id, r.list.name]));
  return { kind: 'MANY', hits: out.hits.map((h) => ({ id: h.id, name: h.name, parentName: listOf.get(h.id) })) };
}

async function findList(env: ResolveEnv, ref: Ref | undefined, preset?: string): Promise<Outcome> {
  if (preset !== undefined) {
    const l = await loadList(env, preset);
    return l ? { kind: 'ONE', hit: l } : { kind: 'NONE', text: 'cột đã chọn' };
  }
  if (ref === undefined) {
    // khong noi cot: bang co dung 1 cot thi dung no, nhieu cot thi hoi
    const lists = await prisma.list.findMany({
      where: { boardId: env.boardId, deletedAt: null, archivedAt: null },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true, name: true },
      take: MAX_CHOICES + 1,
    });
    if (lists.length === 0) return { kind: 'NONE', text: 'cột nào' };
    return lists.length === 1 ? { kind: 'ONE', hit: lists[0] } : { kind: 'MANY', hits: lists };
  }
  if (ref.by === 'CONTEXT') {
    const b = binding(env, 'COLUMN');
    const l = b ? await loadList(env, b.id) : null;
    return l ? { kind: 'ONE', hit: l } : { kind: 'NONE', text: 'cột vừa nhắc' };
  }
  if (ref.by !== 'TEXT') return { kind: 'NONE', text: 'cột' };
  const named = await byName(env.exec, 'COLUMN', ref.text);
  if (named.kind !== 'NONE') return named;
  // "Dang lam" khi cot ten la "In Progress": khop theo TRANG THAI cua cot
  const status = guessListStatus(ref.text) ?? guessListStatus(stripLeadingGeneric(ref.text));
  if (status === null) return named;
  const lists = await prisma.list.findMany({
    where: { boardId: env.boardId, status, deletedAt: null, archivedAt: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, name: true },
  });
  if (lists.length === 0) return named;
  return lists.length === 1 ? { kind: 'ONE', hit: lists[0] } : { kind: 'MANY', hits: lists };
}

async function findMember(env: ResolveEnv, ref: Ref, preset?: string): Promise<Outcome> {
  const person = (id: string): Outcome => {
    const m = env.exec.roster.find((r) => r.userId === id);
    return m ? { kind: 'ONE', hit: { id: m.userId, name: m.name } } : { kind: 'NONE', text: 'thành viên' };
  };
  if (preset !== undefined) return person(preset);
  if (ref.by === 'SELF') return person(env.userId);
  if (ref.by === 'CONTEXT') {
    const b = binding(env, 'MEMBER');
    return b ? person(b.id) : { kind: 'NONE', text: 'người vừa nhắc' };
  }
  if (isSelfReference(ref.text)) return person(env.userId);
  return byName(env.exec, 'MEMBER', ref.text);
}

async function findLabel(env: ResolveEnv, ref: Ref, preset?: string): Promise<Outcome> {
  if (preset !== undefined) {
    const l = await prisma.label.findFirst({ where: { id: preset, boardId: env.boardId }, select: { id: true, name: true } });
    return l ? { kind: 'ONE', hit: l } : { kind: 'NONE', text: 'nhãn đã chọn' };
  }
  if (ref.by !== 'TEXT') return { kind: 'NONE', text: 'nhãn' };
  return byName(env.exec, 'LABEL', ref.text);
}

const isResult = (x: Hit | ResolveResult): x is ResolveResult => 'kind' in x;

/** Mot tham chieu -> mot Hit, hoac mot ket qua dung som (nut chon / loi). */
async function slot(path: PendingChoice['path'], text: string, find: () => Promise<Outcome>): Promise<Hit | ResolveResult> {
  const out = await find();
  if (out.kind === 'ONE') return out.hit;
  if (out.kind === 'NONE') {
    return { kind: 'FAIL', code: 'NOT_FOUND', text: `Không tìm thấy ${WHAT[path]} “${out.text === '' ? text : out.text}” trong bảng này. Chưa thay đổi gì.` };
  }
  if (out.hits.length > MAX_CHOICES) {
    const which = text === '' ? `Hãy nói rõ tên ${WHAT[path]}` : `Có ${out.hits.length} ${WHAT[path]} khớp “${text}”. Hãy nêu rõ hơn (thêm tên đầy đủ)`;
    return { kind: 'FAIL', code: 'AMBIGUOUS', text: `${which}. Chưa thay đổi gì.` };
  }
  return {
    kind: 'CHOICE',
    pending: { path, options: out.hits.map((h) => ({ id: h.id, label: h.parentName ? `${h.name} · ${h.parentName}` : h.name })) },
  };
}

const textOf = (ref: Ref | undefined): string => (ref !== undefined && ref.by === 'TEXT' ? ref.text : '');

/**
 * Phan giai mot thao tac. `presets` = cac id da chot (qua nut chon cua nguoi dung); chung van duoc kiem lai con ton tai trong
 * bang. Tra CHOICE khi con MOT tham chieu nhap nhang (hoi tung cai mot), FAIL khi khong tim thay / qua nhieu.
 */
export async function resolveOp(env: ResolveEnv, symbolic: ActionOp, presets: Presets = {}): Promise<ResolveResult> {
  const warnings: string[] = [];
  const base = { ids: {} as StoredOp['ids'], params: {} as StoredOp['params'], display: {} as StoredOp['display'] };

  switch (symbolic.type) {
    case 'CREATE_CARD': {
      const list = await slot('list', textOf(symbolic.list), () => findList(env, symbolic.list, presets.list));
      if (isResult(list)) return list;
      return {
        kind: 'OK',
        warnings,
        op: { ...base, type: 'CREATE_CARD', ids: { list: list.id }, params: { title: symbolic.title.trim() }, before: null, display: { listName: list.name } },
      };
    }
    case 'RENAME_CARD': {
      const card = await slot('card', textOf(symbolic.card), () => findCard(env, symbolic.card, presets.card));
      if (isResult(card)) return card;
      const row = await loadCard(env, card.id);
      if (!row) return { kind: 'FAIL', code: 'NOT_FOUND', text: 'Thẻ không còn tồn tại. Chưa thay đổi gì.' };
      const title = symbolic.title.trim();
      return {
        kind: 'OK',
        warnings,
        op: {
          ...base,
          type: 'RENAME_CARD',
          ids: { card: row.id },
          params: { title },
          before: { title: row.title },
          display: { cardTitle: row.title },
          ...(title === row.title ? { noop: `Thẻ “${row.title}” đã có tên này rồi nên chưa cần đổi.` } : {}),
        },
      };
    }
    case 'SET_CARD_DUE': {
      const card = await slot('card', textOf(symbolic.card), () => findCard(env, symbolic.card, presets.card));
      if (isResult(card)) return card;
      const row = await loadCard(env, card.id);
      if (!row) return { kind: 'FAIL', code: 'NOT_FOUND', text: 'Thẻ không còn tồn tại. Chưa thay đổi gì.' };
      const resolution = env.due?.resolution;
      if (resolution === undefined || resolution.kind === 'INVALID') {
        return { kind: 'FAIL', code: 'INVALID', text: 'Ngày hạn không hợp lệ. Chưa thay đổi gì.' };
      }
      if (env.due?.llmDiffers) warnings.push('Ngày hạn được lấy theo đúng câu của bạn (khác với ngày AI đề xuất).');
      const before = row.dueDate ? row.dueDate.toISOString() : null;
      const due = resolution.kind === 'CLEAR' ? null : dueIso(resolution.date);
      let noop: string | undefined;
      if (due === null && before === null) noop = `Thẻ “${row.title}” chưa có hạn nên không cần bỏ.`;
      else if (due !== null && before !== null && vnDayOfIso(before) === vnDayOfIso(due)) {
        noop = `Hạn của thẻ “${row.title}” đã là ${formatDueDate(vnDayOfIso(due))} rồi.`;
      }
      return {
        kind: 'OK',
        warnings,
        op: {
          ...base,
          type: 'SET_CARD_DUE',
          ids: { card: row.id },
          params: { due },
          before: { due: before },
          display: { cardTitle: row.title },
          ...(noop !== undefined ? { noop } : {}),
        },
      };
    }
    case 'MOVE_CARD': {
      const card = await slot('card', textOf(symbolic.card), () => findCard(env, symbolic.card, presets.card));
      if (isResult(card)) return card;
      const list = await slot('toList', textOf(symbolic.toList), () => findList(env, symbolic.toList, presets.toList));
      if (isResult(list)) return list;
      const row = await loadCard(env, card.id);
      if (!row) return { kind: 'FAIL', code: 'NOT_FOUND', text: 'Thẻ không còn tồn tại. Chưa thay đổi gì.' };
      return {
        kind: 'OK',
        warnings,
        op: {
          ...base,
          type: 'MOVE_CARD',
          ids: { card: row.id, list: list.id },
          params: {},
          before: { listId: row.listId, listName: row.list.name },
          display: { cardTitle: row.title, toListName: list.name },
          ...(row.listId === list.id ? { noop: `Thẻ “${row.title}” đã ở cột “${list.name}” rồi.` } : {}),
        },
      };
    }
    case 'SET_CARD_STATUS': {
      const card = await slot('card', textOf(symbolic.card), () => findCard(env, symbolic.card, presets.card));
      if (isResult(card)) return card;
      const row = await loadCard(env, card.id);
      if (!row) return { kind: 'FAIL', code: 'NOT_FOUND', text: 'Thẻ không còn tồn tại. Chưa thay đổi gì.' };
      return {
        kind: 'OK',
        warnings,
        op: {
          ...base,
          type: 'SET_CARD_STATUS',
          ids: { card: row.id },
          params: { status: symbolic.status },
          before: { status: row.status, listId: row.listId, listName: row.list.name },
          display: { cardTitle: row.title },
          ...(row.status === symbolic.status ? { noop: `Thẻ “${row.title}” đã ở trạng thái này rồi.` } : {}),
        },
      };
    }
    case 'ASSIGN_MEMBER': {
      const card = await slot('card', textOf(symbolic.card), () => findCard(env, symbolic.card, presets.card));
      if (isResult(card)) return card;
      const member = await slot('member', textOf(symbolic.member), () => findMember(env, symbolic.member, presets.member));
      if (isResult(member)) return member;
      const row = await loadCard(env, card.id);
      if (!row) return { kind: 'FAIL', code: 'NOT_FOUND', text: 'Thẻ không còn tồn tại. Chưa thay đổi gì.' };
      const already = row.members.some((m) => m.userId === member.id);
      return {
        kind: 'OK',
        warnings,
        op: {
          ...base,
          type: 'ASSIGN_MEMBER',
          ids: { card: row.id, member: member.id },
          params: {},
          before: { alreadyAssigned: already },
          display: { cardTitle: row.title, memberName: member.name },
          ...(already ? { noop: `${member.name} đã được giao thẻ “${row.title}” rồi.` } : {}),
        },
      };
    }
    case 'ADD_LABEL': {
      const card = await slot('card', textOf(symbolic.card), () => findCard(env, symbolic.card, presets.card));
      if (isResult(card)) return card;
      const label = await slot('label', textOf(symbolic.label), () => findLabel(env, symbolic.label, presets.label));
      if (isResult(label)) return label;
      const row = await loadCard(env, card.id);
      if (!row) return { kind: 'FAIL', code: 'NOT_FOUND', text: 'Thẻ không còn tồn tại. Chưa thay đổi gì.' };
      const already = row.labels.some((l) => l.labelId === label.id);
      return {
        kind: 'OK',
        warnings,
        op: {
          ...base,
          type: 'ADD_LABEL',
          ids: { card: row.id, label: label.id },
          params: {},
          before: { alreadyLabeled: already },
          display: { cardTitle: row.title, labelName: label.name },
          ...(already ? { noop: `Thẻ “${row.title}” đã có nhãn “${label.name}” rồi.` } : {}),
        },
      };
    }
  }
}
