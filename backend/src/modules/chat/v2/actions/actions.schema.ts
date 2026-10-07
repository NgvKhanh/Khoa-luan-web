// Hop dong HANH DONG cua chatbot v2 - Phase 1 (CHATBOT_V2_ACTIONS_PLAN.md §9).
//
// NGUYEN TAC: rang buoc bang CAU TRUC, khong bang loi dan trong prompt (cung triet ly AI_MODULE.md §3.1). LLM KHONG co o nao de
// dien id cua the / cot / nguoi / nhan: chi co 3 cach chi toi mot thuc the (TEXT = dung chu nguoi dung go, CONTEXT = "no" / "the
// vua roi", SELF = "toi"). Backend tu tim (actions.resolve) roi moi co id. Ngay han cung khong do LLM tinh: LLM chi khai DateSpec,
// server doi (actions.dates). Khoa la (cardId, boardId...) bi .strict() loai ngay o day.

import { z } from 'zod';
import { CardStatus } from '../../../../generated/prisma/enums';

const text = (max: number) => z.string().trim().min(1).max(max);

/** Phase 1: moi ke hoach DUNG MOT thao tac. Schema van nhan toi MAX_PROPOSED_OPS de tra loi ro rang thay vi bao loi cu phap. */
export const MAX_OPS_PER_PLAN = 1;
export const MAX_PROPOSED_OPS = 5;

export const REF_SLOTS = ['LAST_CARD', 'LAST_LIST', 'LAST_MEMBER'] as const;
export type RefSlot = (typeof REF_SLOTS)[number];

export const RefSchema = z.discriminatedUnion('by', [
  z.object({ by: z.literal('TEXT'), text: text(200) }).strict(),
  z.object({ by: z.literal('CONTEXT'), slot: z.enum(REF_SLOTS) }).strict(),
  z.object({ by: z.literal('SELF') }).strict(),
]);
export type Ref = z.infer<typeof RefSchema>;

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

/** 7 thao tac an toan cua Phase 1. */
export const ACTION_TYPES = [
  'CREATE_CARD',
  'RENAME_CARD',
  'SET_CARD_DUE',
  'MOVE_CARD',
  'SET_CARD_STATUS',
  'ASSIGN_MEMBER',
  'ADD_LABEL',
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const ActionOpSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CREATE_CARD'), list: RefSchema.optional(), title: text(500) }).strict(),
  z.object({ type: z.literal('RENAME_CARD'), card: RefSchema, title: text(500) }).strict(),
  z.object({ type: z.literal('SET_CARD_DUE'), card: RefSchema, due: DateSpecSchema }).strict(),
  z.object({ type: z.literal('MOVE_CARD'), card: RefSchema, toList: RefSchema }).strict(),
  z.object({ type: z.literal('SET_CARD_STATUS'), card: RefSchema, status: z.enum(CardStatus) }).strict(),
  z.object({ type: z.literal('ASSIGN_MEMBER'), card: RefSchema, member: RefSchema }).strict(),
  z.object({ type: z.literal('ADD_LABEL'), card: RefSchema, label: RefSchema }).strict(),
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
    'Tham chieu: {by:"TEXT",text:<dung chu nguoi dung go, bo tu chung nhu task/the/cot/nhan>} | {by:"CONTEXT",slot:"LAST_CARD"|"LAST_LIST"|"LAST_MEMBER"} cho "no / the vua roi" | {by:"SELF"} cho "toi". KHONG dien id.',
  properties: {
    by: { type: 'string', enum: ['TEXT', 'CONTEXT', 'SELF'] },
    text: { type: 'string' },
    slot: { type: 'string', enum: [...REF_SLOTS] },
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
          card: refHint,
          list: refHint,
          toList: refHint,
          member: refHint,
          label: refHint,
          title: { type: 'string', description: 'Tieu de moi (CREATE_CARD, RENAME_CARD): dung chu nguoi dung go.' },
          due: dueHint,
          status: { type: 'string', enum: [...Object.values(CardStatus)] },
        },
        required: ['type'],
      },
    },
  },
  required: ['operations'],
} as const;
