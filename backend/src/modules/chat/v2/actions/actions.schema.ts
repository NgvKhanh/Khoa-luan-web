// Hop dong HANH DONG cua chatbot v2 - Phase 1 (mot thao tac) + Phase 2 (nhieu thao tac trong MOT bang).
//
// NGUYEN TAC: rang buoc bang CAU TRUC, khong bang loi dan trong prompt (cung triet ly AI_MODULE.md §3.1). LLM KHONG co o nao de
// dien id cua the / cot / nguoi / nhan: chi co 4 cach chi toi mot thuc the:
//   TEXT    = dung chu nguoi dung go
//   CONTEXT = "no" / "the vua roi"
//   SELF    = "toi"
//   PLAN    = thuc the do CHINH KE HOACH nay se tao (cot / the moi), tro bang `key` cua thao tac tao ra no
// Backend tu tim (actions.resolve) roi moi co id. Ngay han cung khong do LLM tinh: LLM chi khai DateSpec, server doi
// (actions.dates). Khoa la (cardId, boardId...) bi .strict() loai ngay o day.

import { z } from 'zod';
import { CardStatus } from '../../../../generated/prisma/enums';

const text = (max: number) => z.string().trim().min(1).max(max);

/**
 * Gioi han o BACKEND (khong chi trong prompt). `MAX_PROPOSED_OPS` la tran cua schema de mot de xuat qua dai duoc tra loi bang cau
 * ro rang ("chia nho lenh") thay vi loi cu phap; han muc that su cua mot ke hoach la cac MAX_* ben duoi (actions.graph.checkLimits).
 */
export const MAX_PROPOSED_OPS = 30;
export const MAX_OPS_PER_PLAN = 15;
export const MAX_CREATE_CARDS = 10;
export const MAX_CREATE_LISTS = 3;
/** So doi tuong CO SAN (the / cot / nguoi / nhan khac nhau) ma mot ke hoach duoc nhac toi. */
export const MAX_REFERENCED = 20;

/** Bo gioi han cua mot ke hoach. Ke hoach thuong dung `DEFAULT_LIMITS`; Board Patch (Phase 3) co han muc rieng (actions.patch.schema). */
export interface PlanLimits {
  maxOps: number;
  maxLists: number;
  maxCards: number;
  maxRefs: number;
}
export const DEFAULT_LIMITS: PlanLimits = { maxOps: MAX_OPS_PER_PLAN, maxLists: MAX_CREATE_LISTS, maxCards: MAX_CREATE_CARDS, maxRefs: MAX_REFERENCED };

export const REF_SLOTS = ['LAST_CARD', 'LAST_LIST', 'LAST_MEMBER'] as const;
export type RefSlot = (typeof REF_SLOTS)[number];

/** Khoa cua thao tac tao thuc the moi: chu cai dau, chi chu / so / gach duoi (dung de tham chieu trong cung ke hoach). */
export const PLAN_KEY_RE = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
const planKey = z.string().trim().regex(PLAN_KEY_RE);

export const RefSchema = z.discriminatedUnion('by', [
  z.object({ by: z.literal('TEXT'), text: text(200) }).strict(),
  z.object({ by: z.literal('CONTEXT'), slot: z.enum(REF_SLOTS) }).strict(),
  z.object({ by: z.literal('SELF') }).strict(),
  z.object({ by: z.literal('PLAN'), key: planKey }).strict(),
]);
export type Ref = z.infer<typeof RefSchema>;
/**
 * Phase 6: rieng o `member` cua ASSIGN_MEMBER con co `{by:'BEST'}` = "nguoi phu hop nhat" (server tu chon bang module goi y phan cong, luon xem
 * truoc). Cac o khac (the, cot, nhan...) KHONG co BEST nen mo hinh khong the dung no de ne tranh goi ten.
 */
export const MemberRefSchema = z.discriminatedUnion('by', [...RefSchema.options, z.object({ by: z.literal('BEST') }).strict()]);
export type MemberRef = z.infer<typeof MemberRefSchema>;

/**
 * Phase 7 - LUAT TU DONG HOA bang ngon ngu tu nhien. Chi anh xa vao nhung gi engine (modules/automation) co: 2 dieu kien kich hoat va 3 hanh dong
 * (toi da 5). Luat chi nham vao thuc the CO SAN (TEXT / CONTEXT / SELF): khong PLAN (khong tao cot + luat trong cung lenh), khong BEST.
 */
export const RULE_TRIGGERS = ['CARD_CREATED', 'CARD_MOVED_TO_LIST'] as const;
export type RuleTrigger = (typeof RULE_TRIGGERS)[number];
export const MAX_RULE_ACTIONS = 5;
const RuleRefSchema = z.discriminatedUnion('by', [
  z.object({ by: z.literal('TEXT'), text: text(200) }).strict(),
  z.object({ by: z.literal('CONTEXT'), slot: z.enum(REF_SLOTS) }).strict(),
  z.object({ by: z.literal('SELF') }).strict(),
]);
export const RuleActionSchema = z.discriminatedUnion('type', [
  // done = true (mac dinh): danh dau hoan thanh; done = false: mo lai (bo danh dau hoan thanh)
  z.object({ type: z.literal('SET_DONE'), done: z.boolean().optional() }).strict(),
  z.object({ type: z.literal('ADD_LABEL'), label: RuleRefSchema }).strict(),
  z.object({ type: z.literal('ASSIGN_MEMBER'), member: RuleRefSchema }).strict(),
]);
export type RuleAction = z.infer<typeof RuleActionSchema>;

export const DateSpecSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('ABSOLUTE'), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict(),
  // weekday: 1 = Thu Hai ... 7 = Chu nhat (ISO)
  z.object({ type: z.literal('WEEKDAY'), weekday: z.number().int().min(1).max(7), week: z.enum(['THIS', 'NEXT']) }).strict(),
  z.object({ type: z.literal('RELATIVE_DAYS'), days: z.number().int().min(-30).max(365) }).strict(),
  z.object({ type: z.literal('END_OF_WEEK') }).strict(),
  // bo han
  z.object({ type: z.literal('NONE') }).strict(),
]);
export type DateSpec = z.infer<typeof DateSpecSchema>;

/** 7 thao tac cua Phase 1 + CREATE_LIST (can cho ke hoach nhieu buoc: tao cot roi tao the trong cot do). */
export const ACTION_TYPES = [
  'CREATE_LIST',
  'CREATE_CARD',
  'RENAME_CARD',
  'SET_CARD_DUE',
  'MOVE_CARD',
  'SET_CARD_STATUS',
  'ASSIGN_MEMBER',
  'ADD_LABEL',
  'ASSIGN_UNASSIGNED',
  'CREATE_AUTOMATION_RULE',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

/**
 * Thao tac duoc phep TU CHAY khi dung 1 thao tac (Phase 1). CREATE_LIST khong nam trong day: no doi CAU TRUC bang (va ten cot co the
 * keo theo trang thai, vd "Hoan thanh" -> DONE) nen luon cho xem truoc.
 */
export const AUTO_RUN_TYPES: readonly ActionType[] = [
  'CREATE_CARD',
  'RENAME_CARD',
  'SET_CARD_DUE',
  'MOVE_CARD',
  'SET_CARD_STATUS',
  'ASSIGN_MEMBER',
  'ADD_LABEL',
];

export const ActionOpSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CREATE_LIST'), key: planKey.optional(), name: text(100) }).strict(),
  z.object({ type: z.literal('CREATE_CARD'), key: planKey.optional(), list: RefSchema.optional(), title: text(500) }).strict(),
  z.object({ type: z.literal('RENAME_CARD'), card: RefSchema, title: text(500) }).strict(),
  z.object({ type: z.literal('SET_CARD_DUE'), card: RefSchema, due: DateSpecSchema }).strict(),
  z.object({ type: z.literal('MOVE_CARD'), card: RefSchema, toList: RefSchema }).strict(),
  z.object({ type: z.literal('SET_CARD_STATUS'), card: RefSchema, status: z.enum(CardStatus) }).strict(),
  z.object({ type: z.literal('ASSIGN_MEMBER'), card: RefSchema, member: MemberRefSchema }).strict(),
  // Phase 6: chia cac the CHUA co nguoi nhan cua mot cot cho nhom (server goi planForList va khai trien thanh nhieu ASSIGN_MEMBER)
  z.object({ type: z.literal('ASSIGN_UNASSIGNED'), list: RefSchema }).strict(),
  z.object({ type: z.literal('ADD_LABEL'), card: RefSchema, label: RefSchema }).strict(),
  // Phase 7: luat tu dong hoa (luon xem truoc, rui ro CAO, phai la thao tac DUY NHAT cua ke hoach)
  z.object({ type: z.literal('CREATE_AUTOMATION_RULE'), trigger: z.enum(RULE_TRIGGERS), list: RuleRefSchema.optional(), actions: z.array(RuleActionSchema).min(1).max(MAX_RULE_ACTIONS) }).strict(),
]);
export type ActionOp = z.infer<typeof ActionOpSchema>;

/**
 * Bo cac khoa null / chuoi rong truoc khi kiem tra: Gemini hay dien khoa thua ("list": null) khi luoc do phang. Chi bo gia tri
 * RONG - mot khoa la co gia tri that (vd "cardId": "abc") van bi .strict() tu choi.
 */
export function dropEmpty(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(dropEmpty);
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === null || v === undefined || v === '') continue;
    out[key] = dropEmpty(v);
  }
  return out;
}

export const ProposeActionsInput = z.object({ operations: z.array(ActionOpSchema).min(1).max(MAX_PROPOSED_OPS) }).strict();
export type ProposeActions = z.infer<typeof ProposeActionsInput>;

/** Schema dua vao registry: bo khoa rong roi moi kiem tra. */
export const proposeActionsSchema = z.preprocess(dropEmpty, ProposeActionsInput);

const refHint = {
  type: 'object',
  description:
    'Tham chieu: {by:"TEXT",text:<dung chu nguoi dung go, bo tu chung nhu task/the/cot/nhan>} | {by:"CONTEXT",slot:"LAST_CARD"|"LAST_LIST"|"LAST_MEMBER"} cho "no / the vua roi" | {by:"SELF"} cho "toi" | {by:"PLAN",key:<key cua thao tac CREATE_LIST / CREATE_CARD trong CUNG danh sach>} cho cot / the ma chinh lenh nay tao ra | CHI o member cua ASSIGN_MEMBER: {by:"BEST"} khi nguoi dung nho chon "nguoi phu hop nhat" (khong goi ten). KHONG dien id.',
  properties: {
    by: { type: 'string', enum: ['TEXT', 'CONTEXT', 'SELF', 'PLAN', 'BEST'] },
    text: { type: 'string' },
    slot: { type: 'string', enum: [...REF_SLOTS] },
    key: { type: 'string' },
  },
  required: ['by'],
} as const;

const dueHint = {
  type: 'object',
  description:
    'Han: ABSOLUTE(date YYYY-MM-DD, chi khi nguoi dung viet ngay cu the) | WEEKDAY(weekday 1=Thu Hai..7=Chu nhat, week THIS|NEXT) | RELATIVE_DAYS(days, 0=hom nay) | END_OF_WEEK | NONE(bo han). Khong tu tinh ngay.',
  properties: {
    type: { type: 'string', enum: ['ABSOLUTE', 'WEEKDAY', 'RELATIVE_DAYS', 'END_OF_WEEK', 'NONE'] },
    date: { type: 'string' },
    weekday: { type: 'number' },
    week: { type: 'string', enum: ['THIS', 'NEXT'] },
    days: { type: 'number' },
  },
  required: ['type'],
} as const;

/**
 * Luoc do GUI Gemini (phang, viet tay). Khong sinh tu Zod vi `providerSchema` (chat.v2.registry) thay moi `anyOf` toan object
 * bang goi y pham vi; Zod o server van la nguon su that (.strict()).
 */
export const PROPOSE_ACTIONS_PROVIDER_SCHEMA = {
  type: 'object',
  properties: {
    operations: {
      type: 'array',
      minItems: 1,
      maxItems: MAX_PROPOSED_OPS,
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: [...ACTION_TYPES] },
          key: { type: 'string', description: 'CREATE_LIST / CREATE_CARD: khoa ngan (chu, so, gach duoi) de thao tac khac tro toi cot / the vua tao.' },
          name: { type: 'string', description: 'CREATE_LIST: ten cot moi, dung chu nguoi dung go.' },
          card: refHint,
          list: refHint,
          toList: refHint,
          member: refHint,
          label: refHint,
          title: { type: 'string', description: 'Tieu de moi (CREATE_CARD, RENAME_CARD): dung chu nguoi dung go.' },
          due: dueHint,
          status: { type: 'string', enum: [...Object.values(CardStatus)] },
          trigger: { type: 'string', enum: [...RULE_TRIGGERS], description: 'CREATE_AUTOMATION_RULE: CARD_CREATED = khi co the MOI duoc tao (list = cot, bo trong = moi cot); CARD_MOVED_TO_LIST = khi the duoc chuyen VAO cot (list bat buoc).' },
          actions: {
            type: 'array',
            minItems: 1,
            maxItems: MAX_RULE_ACTIONS,
            description: 'CREATE_AUTOMATION_RULE: cac hanh dong luat se lam (toi da 5): SET_DONE (done false = mo lai) | ADD_LABEL (label) | ASSIGN_MEMBER (member).',
            items: {
              type: 'object',
              properties: { type: { type: 'string', enum: ['SET_DONE', 'ADD_LABEL', 'ASSIGN_MEMBER'] }, done: { type: 'boolean' }, label: refHint, member: refHint },
              required: ['type'],
            },
          },
        },
        required: ['type'],
      },
    },
  },
  required: ['operations'],
} as const;
