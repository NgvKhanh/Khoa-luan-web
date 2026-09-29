// Loi thuan cua bo danh gia chatbot (CHATBOT_MODULE.md §14): duong xu ly chung cho 3 nhanh, cham diem,
// chi so. KHONG doc env, KHONG ra mang, KHONG cham DB -> test duoc truc tiep (test/chat.eval.test.ts).
//
// Ba nhanh chi khac o buoc HIEU CAU; sau do deu di qua DUNG cac ham cua san pham, dung thu tu cua
// chat.service (pham vi WORKSPACE): applyFollowUp -> resolveSlots -> (MEMBER_TASKS) nhan dien nguoi.
// Co test doi chieu ket qua cua outcomeOf voi handleMessage that tren CSDL.

import { applyFollowUp, type FollowUpContext } from '../modules/chat/chat.followup';
import { resolveSlots, type AnswerIntent, type ChatFocus, type ChatPeriod, type ChatSlot, type ParsedQuestion } from '../modules/chat/chat.intent';
import { mergeParsed } from '../modules/chat/chat.llm';
import { resolveMemberRef, type RosterMember } from '../modules/chat/chat.members';
import { bootstrapMeanCI, comparePaired, type Interval, type PairedComparison } from './evalAssignStats';

export type ArmId = 'B0' | 'B1' | 'B2';
export const ARMS: readonly ArmId[] = ['B0', 'B1', 'B2'];

/** Ket qua cuoi cua mot luot hieu cau (truoc khi truy van CSDL). */
export type GoldOutcome =
  | { kind: 'QUERY'; intent: AnswerIntent; period: ChatPeriod | null; focus: ChatFocus | null; member: string | null; ignored: ChatSlot[] }
  | { kind: 'UNSUPPORTED' }
  | { kind: 'ASK_WHO' }
  | { kind: 'CLARIFY_MEMBER'; candidates: string[] }
  | { kind: 'MEMBER_NOT_FOUND' };

/** + LLM that bai o nhanh B1 (sai moi truong, ghi loai loi). */
export type Outcome = GoldOutcome | { kind: 'LLM_FAILED'; reason: string };

/** Ket qua hieu cau bang LLM cua mot (cau, lan chay) - DUNG CHUNG cho B1 va B2. */
export type LlmParse = { ok: true; parsed: ParsedQuestion } | { ok: false; reason: string };

// ===================== Duong xu ly =====================

/** Sao y chat.service.answerQuestion (pham vi WORKSPACE) nhung dung o truoc buoc truy van. */
export function outcomeOf(parsed: ParsedQuestion, prev: FollowUpContext | null, roster: readonly RosterMember[]): GoldOutcome {
  const fu = applyFollowUp(parsed, prev);
  if (fu.kind === 'UNSUPPORTED') return { kind: 'UNSUPPORTED' };
  const q = fu.question;
  const r = resolveSlots(q);
  let member: string | null = null;
  if (r.intent === 'MEMBER_TASKS') {
    if (q.memberText === null && q.memberUserId === null) return { kind: 'ASK_WHO' };
    const m = resolveMemberRef(q, roster);
    if (m.kind === 'NONE') return { kind: 'MEMBER_NOT_FOUND' };
    if (m.kind === 'MANY') return { kind: 'CLARIFY_MEMBER', candidates: m.members.map((x) => x.userId).sort() };
    member = m.member.userId;
  }
  return { kind: 'QUERY', intent: r.intent, period: r.period, focus: r.focus, member, ignored: r.ignoredSlots };
}

/** Buoc hieu cau cua tung nhanh; null = LLM that bai o nhanh chi-LLM. */
export function armParse(arm: ArmId, rules: ParsedQuestion, llm: LlmParse | null, roster: readonly RosterMember[]): ParsedQuestion | null {
  if (arm === 'B0') return rules;
  if (llm === null) throw new Error(`nhanh ${arm} can phan hoi LLM`);
  if (arm === 'B1') return llm.ok ? llm.parsed : null;
  return llm.ok ? mergeParsed(rules, llm.parsed, roster) : rules;
}

export function runArm(
  arm: ArmId,
  rules: ParsedQuestion,
  llm: LlmParse | null,
  prev: FollowUpContext | null,
  roster: readonly RosterMember[]
): Outcome {
  const parsed = armParse(arm, rules, llm, roster);
  if (parsed === null) return { kind: 'LLM_FAILED', reason: llm !== null && !llm.ok ? llm.reason : 'UNKNOWN' };
  return outcomeOf(parsed, prev, roster);
}

// ===================== Cham diem mot cau =====================

export const INTENT_LABELS = ['MY_TASKS', 'MY_PRIORITIES', 'MEMBER_TASKS', 'TEAM_SUMMARY', 'TEAM_WORKLOAD', 'UNSUPPORTED'] as const;
export type IntentLabel = (typeof INTENT_LABELS)[number];
export type PredLabel = IntentLabel | 'LLM_FAILED';

/** Nhan y dinh (6 nhan §14.4): hoi lai / khong tim thay nguoi / hoi "ai?" deu la MEMBER_TASKS. */
export function labelOf(o: Outcome): PredLabel {
  switch (o.kind) {
    case 'QUERY':
      return o.intent;
    case 'UNSUPPORTED':
      return 'UNSUPPORTED';
    case 'LLM_FAILED':
      return 'LLM_FAILED';
    default:
      return 'MEMBER_TASKS';
  }
}

/** Phan "nguoi" cua ket qua (chi co nghia khi nhan la MEMBER_TASKS). */
function memberPart(o: Outcome): string {
  if (o.kind === 'QUERY') return `ID:${o.member}`;
  if (o.kind === 'CLARIFY_MEMBER') return `CLARIFY:${[...o.candidates].sort().join(',')}`;
  return o.kind;
}

/** Khoa so sanh "khop hoan toan": moi truong tru ignoredSlots (cham rieng). */
export function outcomeKey(o: Outcome): string {
  if (o.kind === 'QUERY') return `QUERY|${o.intent}|${o.period}|${o.focus}|${o.member}`;
  if (o.kind === 'CLARIFY_MEMBER') return memberPart(o);
  if (o.kind === 'LLM_FAILED') return 'LLM_FAILED';
  return o.kind;
}

export interface ItemScore {
  intent: boolean;
  /** null = khong ap dung (nhan vang khong phai truy van). */
  period: boolean | null;
  focus: boolean | null;
  /** null = nhan vang khong phai cau hoi ve mot nguoi. */
  member: boolean | null;
  full: boolean;
  /** Chi xet khi khop hoan toan va la truy van: tap tham so bi bo qua co dung khong. */
  ignored: boolean | null;
  /** Chi xet cau vang la hoi lai (trung ten / thieu ten). */
  clarify: boolean | null;
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

export function scoreItem(gold: GoldOutcome, pred: Outcome): ItemScore {
  const full = outcomeKey(gold) === outcomeKey(pred);
  const query = gold.kind === 'QUERY';
  return {
    intent: labelOf(gold) === labelOf(pred),
    period: query ? pred.kind === 'QUERY' && pred.period === gold.period : null,
    focus: query ? pred.kind === 'QUERY' && pred.focus === gold.focus : null,
    member: labelOf(gold) === 'MEMBER_TASKS' ? labelOf(pred) === 'MEMBER_TASKS' && memberPart(pred) === memberPart(gold) : null,
    full,
    ignored: query && full && pred.kind === 'QUERY' ? sameSet(pred.ignored, gold.ignored) : null,
    clarify: gold.kind === 'CLARIFY_MEMBER' || gold.kind === 'ASK_WHO' ? outcomeKey(pred) === outcomeKey(gold) : null,
  };
}

// ===================== Chi so gop =====================

export interface ScoredRun {
  itemId: string;
  run: number;
  gold: GoldOutcome;
  pred: Outcome;
  score: ItemScore;
}

function rate(values: ReadonlyArray<boolean | null>): { hits: number; n: number; rate: number | null } {
  const xs = values.filter((v): v is boolean => v !== null);
  const hits = xs.filter(Boolean).length;
  return { hits, n: xs.length, rate: xs.length === 0 ? null : hits / xs.length };
}

export type Confusion = Record<IntentLabel, Record<PredLabel, number>>;

export function confusionOf(runs: readonly ScoredRun[]): Confusion {
  const cols: PredLabel[] = [...INTENT_LABELS, 'LLM_FAILED'];
  const m = Object.fromEntries(INTENT_LABELS.map((g) => [g, Object.fromEntries(cols.map((p) => [p, 0]))])) as Confusion;
  for (const r of runs) m[labelOf(r.gold) as IntentLabel][labelOf(r.pred)] += 1;
  return m;
}

/**
 * Macro-F1 tren 6 nhan: trung binh F1 cua tung nhan co trong nhan vang. LLM_FAILED la mot du doan SAI
 * (giam recall cua nhan vang, khong cong vao precision cua nhan nao).
 */
export function macroF1(conf: Confusion): { macro: number | null; perLabel: Record<IntentLabel, number | null> } {
  const perLabel = {} as Record<IntentLabel, number | null>;
  const used: number[] = [];
  for (const label of INTENT_LABELS) {
    const tp = conf[label][label];
    const support = Object.values(conf[label]).reduce((a, b) => a + b, 0);
    const predicted = INTENT_LABELS.reduce((a, g) => a + conf[g][label], 0);
    if (support === 0) {
      perLabel[label] = null;
      continue;
    }
    const precision = predicted === 0 ? 0 : tp / predicted;
    const recall = tp / support;
    const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
    perLabel[label] = f1;
    used.push(f1);
  }
  return { macro: used.length === 0 ? null : used.reduce((a, b) => a + b, 0) / used.length, perLabel };
}

export interface ArmSummary {
  runs: number;
  intent: ReturnType<typeof rate>;
  period: ReturnType<typeof rate>;
  focus: ReturnType<typeof rate>;
  member: ReturnType<typeof rate>;
  full: ReturnType<typeof rate>;
  ignored: ReturnType<typeof rate>;
  clarify: ReturnType<typeof rate>;
  llmFailed: number;
  macroF1: number | null;
  perLabelF1: Record<IntentLabel, number | null>;
  confusion: Confusion;
}

export function summarizeArm(runs: readonly ScoredRun[]): ArmSummary {
  const conf = confusionOf(runs);
  const f1 = macroF1(conf);
  return {
    runs: runs.length,
    intent: rate(runs.map((r) => r.score.intent)),
    period: rate(runs.map((r) => r.score.period)),
    focus: rate(runs.map((r) => r.score.focus)),
    member: rate(runs.map((r) => r.score.member)),
    full: rate(runs.map((r) => r.score.full)),
    ignored: rate(runs.map((r) => r.score.ignored)),
    clarify: rate(runs.map((r) => r.score.clarify)),
    llmFailed: runs.filter((r) => r.pred.kind === 'LLM_FAILED').length,
    macroF1: f1.macro,
    perLabelF1: f1.perLabel,
    confusion: conf,
  };
}

/** Diem "khop hoan toan" cua TUNG CAU = trung binh qua cac lan chay (don vi doc lap cua bootstrap). */
export function perItemFull(runs: readonly ScoredRun[], itemIds: readonly string[]): number[] {
  return itemIds.map((id) => {
    const mine = runs.filter((r) => r.itemId === id);
    if (mine.length === 0) throw new Error(`thieu ket qua cho cau ${id}`);
    return mine.filter((r) => r.score.full).length / mine.length;
  });
}

const BOOT = { resamples: 10_000, level: 0.95, seed: 20260929 };

/** Khoang tin cay 95% bootstrap theo CAU cho ti le khop hoan toan. */
export function fullMatchCI(runs: readonly ScoredRun[], itemIds: readonly string[]): Interval | null {
  if (itemIds.length < 2) return null;
  return bootstrapMeanCI(perItemFull(runs, itemIds), BOOT);
}

/** Chenh lech CAP a - b (cung cau) cho ti le khop hoan toan. */
export function pairedFull(a: readonly ScoredRun[], b: readonly ScoredRun[], itemIds: readonly string[]): PairedComparison | null {
  if (itemIds.length < 2) return null;
  return comparePaired(perItemFull(a, itemIds), perItemFull(b, itemIds), BOOT);
}
