// PREFLIGHT (CHATBOT_V2_ACTIONS_PLAN.md, Phase 2): moi buoc TRUOC KHI ghi bat ky dong nao vao CSDL.
//
//   1. hinh dang  (thuan)  : gioi han -> tu noi chu thanh tham chieu noi bo -> do thi phu thuoc (khong vong, khong thieu, khong sai loai)
//   2. nguon goc  (thuan)  : tung thao tac co do chinh cau cua nguoi dung yeu cau khong (DATA khong phai CHI DAN)
//   3. phan giai  (CSDL)   : the / cot / nguoi / nhan co san -> id, trong DUNG bang cua ke hoach; trung ten -> nut chon; khong thay -> loi
//   4. nghiep vu  (CSDL)   : trung / mau thuan giua cac thao tac
//   5. quyen      (CSDL)   : actions.guard.guardPlan cho TAT CA thao tac
// Mot buoc bao loi -> khong thao tac nao duoc ghi. Cung cac ham nay duoc goi LAI luc "Ap dung" de phat hien du lieu da doi (STALE).

import type { IsoDate } from '../../../ai/ai.dates';
import { resolveEntities } from '../chat.v2.entities';
import type { EntityOption } from '../chat.v2.entities';
import type { ExecutionContext } from '../chat.v2.scope';
import { shapePlan, type LimitErrorCode } from './actions.graph';
import { assessPlanProvenance, type PlanProvenance } from './actions.provenance';
import { slotsOf } from './actions.refs';
import { resolveOps, type Presets, type ResolveOpsResult } from './actions.resolve';
import type { ActionOp } from './actions.schema';
import { canonicalJson, stateDigest, staleReasonOf } from './actions.plan';
import type { ActionErrorCode, StoredOp, StoredPlan } from './actions.types';

export interface Prepared {
  /** Thao tac da gan key + noi tham chieu, THEO THU TU CHAY (topo on dinh). */
  ordered: ActionOp[];
  prov: PlanProvenance;
  /** Chu cua cac tham chieu THE da duoc tu noi vao the sap tao (de canh bao khi bang cung co the cung ten). */
  linkedCardTexts: string[];
  /** Ghi chu hien o ban xem truoc (vd "no" duoc hieu la the moi). */
  notes: string[];
}

export type PrepareResult = { ok: true; prepared: Prepared } | { ok: false; code: ActionErrorCode; text: string };

const LIMIT_CODES: ReadonlySet<string> = new Set<LimitErrorCode>(['TOO_MANY_OPS', 'TOO_MANY_CARDS', 'TOO_MANY_LISTS', 'TOO_MANY_REFS']);

/** Pha thuan: hinh dang + nguon goc. `today` = ngay lich o Viet Nam luc LAP ke hoach (khong doc dong ho o day). */
export function prepare(proposed: readonly ActionOp[], message: string, today: IsoDate): PrepareResult {
  const shaped = shapePlan(proposed);
  if (!shaped.ok) {
    const code: ActionErrorCode = LIMIT_CODES.has(shaped.code) ? (shaped.code as LimitErrorCode) : 'INVALID_PLAN';
    return { ok: false, code, text: shaped.text };
  }
  const ordered = shaped.order.map((i) => shaped.ops[i]);
  const linkedCardTexts: string[] = [];
  for (const [i, original] of proposed.entries()) {
    const after = slotsOf(shaped.ops[i]);
    for (const slot of slotsOf(original)) {
      if (slot.kind !== 'card' || slot.ref?.by !== 'TEXT') continue;
      if (after.find((s) => s.name === slot.name)?.ref?.by === 'PLAN' && !linkedCardTexts.includes(slot.ref.text)) linkedCardTexts.push(slot.ref.text);
    }
  }
  return { ok: true, prepared: { ordered, prov: assessPlanProvenance(ordered, message, today), linkedCardTexts, notes: shaped.notes } };
}

export interface ResolveArgs {
  userId: string;
  exec: ExecutionContext;
  boardId: string;
  bindings: readonly EntityOption[];
  prepared: Prepared;
  presets: Presets;
}

export type ResolvedPlan =
  | { kind: 'OK'; ops: StoredOp[]; warnings: string[]; pins: Record<string, string> }
  | Exclude<ResolveOpsResult, { kind: 'OK' }>;

/** Pha CSDL: phan giai moi tham chieu, tim trung / mau thuan. Chua kiem quyen (guardPlan lam o buoc sau). */
export async function resolvePrepared(args: ResolveArgs): Promise<ResolvedPlan> {
  const { prepared } = args;
  const res = await resolveOps(
    { userId: args.userId, exec: args.exec, boardId: args.boardId, bindings: args.bindings },
    prepared.ordered,
    args.presets,
    prepared.prov.perOp.map((p) => p.due)
  );
  if (res.kind !== 'OK') return res;
  const warnings = [...res.warnings, ...prepared.notes];
  // "giao Unit Test cho Nam" hieu la the MOI sap tao; neu bang da co the gan ten do thi noi ro de nguoi dung kiem tra o ban xem truoc
  for (const text of prepared.linkedCardTexts) {
    const existing = await resolveEntities(args.exec, 'CARD', text);
    if (existing.status !== 'NOT_FOUND') warnings.push(`“${text}” được hiểu là thẻ MỚI sắp tạo trong kế hoạch này (bảng cũng đã có thẻ tên tương tự).`);
  }
  return { kind: 'OK', ops: res.ops, warnings, pins: res.pins };
}

export type RebuildResult =
  | { kind: 'SAME' }
  | { kind: 'CHANGED'; reason: string }
  | { kind: 'UNRESOLVABLE'; code: ActionErrorCode; reason: string };

/**
 * DUNG LAI ke hoach tu phan tuong trung da luu + cac id da ghim, roi so voi ke hoach luc xem truoc. Khac (id, gia tri cu, ten, mot
 * tham chieu khong con duy nhat / khong con tim thay...) thi ke hoach da CU: khong ghi de thay doi moi cua nguoi khac.
 * Ngay luc lap ke hoach dung `createdAt` de "thu sau" khong troi neu nguoi dung bam Ap dung sang ngay hom sau.
 */
export async function rebuildAndCompare(args: {
  userId: string;
  exec: ExecutionContext;
  stored: StoredPlan;
  today: IsoDate;
}): Promise<RebuildResult> {
  const { stored } = args;
  const prep = prepare(stored.symbolic, stored.message, args.today);
  if (!prep.ok) return { kind: 'UNRESOLVABLE', code: prep.code, reason: prep.text };
  const res = await resolvePrepared({ userId: args.userId, exec: args.exec, boardId: stored.boardId, bindings: [], prepared: prep.prepared, presets: stored.presets });
  if (res.kind === 'CHOICE') return { kind: 'CHANGED', reason: 'Có thêm đối tượng cùng tên kể từ lúc xem trước nên mình không còn chắc bạn muốn đối tượng nào.' };
  if (res.kind === 'FAIL') return { kind: 'UNRESOLVABLE', code: res.code === 'NOT_FOUND' ? 'STALE' : res.code, reason: res.text };
  const seen = stored.ops;
  const expected = stored.stateDigest ?? stateDigest(seen);
  if (stateDigest(res.ops) === expected) return { kind: 'SAME' };
  const at = seen.findIndex((op, i) => res.ops[i] === undefined || canonicalJson(op) !== canonicalJson(res.ops[i]));
  return { kind: 'CHANGED', reason: at >= 0 && res.ops[at] !== undefined ? staleReasonOf(seen[at], res.ops[at]) : 'Dữ liệu đã thay đổi kể từ lúc xem trước.' };
}
