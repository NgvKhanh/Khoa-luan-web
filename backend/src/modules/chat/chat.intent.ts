// Y dinh + tham so cua chatbot (CHATBOT_MODULE.md §4, §5.2).
//
// HAM THUAN, khong DB, khong mang, khong doc dong ho. Ca bo luat (B0), lop LLM (B1)
// va bo danh gia deu dung chung cac kieu + ham o day, nen day la "hop dong" trong ma.

import { z } from 'zod';

/** Do dai toi da cua cau hoi (API chan o chat.schema; bo luat tu cat them lan nua). */
export const MAX_QUESTION_CHARS = 500;
/** Do dai toi da cua chuoi ten nguoi LLM tra ve. */
export const MAX_MEMBER_CHARS = 80;
/** Danh sach chinh phan trang 10 the; danh sach phu toi da 5 the (§6.3). */
export const PAGE_SIZE = 10;
export const SECTION_SIZE = 5;

/** 5 y dinh tra loi duoc. */
export const ANSWER_INTENTS = [
  'MY_TASKS',
  'MY_PRIORITIES',
  'MEMBER_TASKS',
  'TEAM_SUMMARY',
  'TEAM_WORKLOAD',
] as const;
/** + UNSUPPORTED (ngoai pham vi / yeu cau thao tac) va NONE (cau chi bo sung tham so). */
export const CHAT_INTENTS = [...ANSWER_INTENTS, 'UNSUPPORTED', 'NONE'] as const;
export const CHAT_PERIODS = [
  'TODAY',
  'TOMORROW',
  'THIS_WEEK',
  'NEXT_WEEK',
  'LAST_WEEK',
  'NEXT_7_DAYS',
] as const;
export const CHAT_FOCUSES = ['OPEN', 'OVERDUE', 'DONE', 'BLOCKED'] as const;

export type AnswerIntent = (typeof ANSWER_INTENTS)[number];
export type ChatIntent = (typeof CHAT_INTENTS)[number];
export type ChatPeriod = (typeof CHAT_PERIODS)[number];
export type ChatFocus = (typeof CHAT_FOCUSES)[number];
export type ChatSlot = 'period' | 'focus' | 'member';

/** Ket qua "hieu cau hoi" cua ca bo luat lan LLM (da doi NONE / "" thanh null). */
export interface ParsedQuestion {
  intent: ChatIntent;
  period: ChatPeriod | null;
  focus: ChatFocus | null;
  /** Ten nguoi NHU NGUOI DUNG GO (chua nhan dien); null = khong nhac ai. */
  member: string | null;
}

export function isAnswerIntent(intent: ChatIntent): intent is AnswerIntent {
  return (ANSWER_INTENTS as readonly string[]).includes(intent);
}

/** Ky nam hoan toan o tuong lai -> khong the co viec "da xong" trong ky (§5.2). */
export function isFuturePeriod(period: ChatPeriod): boolean {
  return period === 'TOMORROW' || period === 'NEXT_WEEK' || period === 'NEXT_7_DAYS';
}

// ===================== Luoc do gui LLM (§4.3) =====================
// Phang, moi khoa bat buoc, KHONG co null trong enum (dung "NONE" / "") - cung kieu
// voi LLM_DRAFT_JSON_SCHEMA ma Gemini da chap nhan o che do json_schema. Khong dung
// maxLength (khong chac nha cung cap nao cung nhan): Zod ben duoi moi la cua kiem
// soat that, co test doi chieu hai ben.

export const INTENT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['intent', 'period', 'focus', 'member'],
  properties: {
    intent: {
      type: 'string',
      enum: [...CHAT_INTENTS],
      description: 'Y dinh cua cau hoi. NONE neu cau chi bo sung tham so cho cau truoc.',
    },
    period: {
      type: 'string',
      enum: [...CHAT_PERIODS, 'NONE'],
      description: 'Khoang thoi gian nguoi dung nhac toi; NONE neu khong nhac.',
    },
    focus: {
      type: 'string',
      enum: [...CHAT_FOCUSES, 'NONE'],
      description: 'Tinh trang cong viec can loc; NONE neu khong nhac.',
    },
    member: {
      type: 'string',
      description: 'Ten nguoi duoc hoi toi, dung nhu trong cau hoi; chuoi rong neu khong co.',
    },
  },
} as const;

const llmIntentSchema = z
  .object({
    intent: z.enum(CHAT_INTENTS),
    period: z.enum([...CHAT_PERIODS, 'NONE']),
    focus: z.enum([...CHAT_FOCUSES, 'NONE']),
    member: z.string().max(MAX_MEMBER_CHARS),
  })
  .strict();

/**
 * Kiem hinh dang phan hoi LLM (JSON tho da parse). null = sai hinh dang -> nguoi goi
 * coi nhu LLM that bai (INVALID_SHAPE) va lui ve bo luat. Khong bao gio nem loi.
 */
export function parseLlmIntent(raw: unknown): ParsedQuestion | null {
  const r = llmIntentSchema.safeParse(raw);
  if (!r.success) return null;
  const member = r.data.member.trim();
  return {
    intent: r.data.intent,
    period: r.data.period === 'NONE' ? null : r.data.period,
    focus: r.data.focus === 'NONE' ? null : r.data.focus,
    member: member === '' ? null : member,
  };
}

// ===================== Tham so hieu luc (§4.4, §5.2) =====================

/** Cau hoi sau buoc noi tiep (chat.followup), y dinh da la 1 trong 5 y dinh tra loi. */
export interface FinalQuestion {
  intent: AnswerIntent;
  period: ChatPeriod | null;
  focus: ChatFocus | null;
  /** Ten go moi (chua nhan dien). */
  memberText: string | null;
  /** Nguoi da nhan dien o luot truoc (ke thua qua phien). */
  memberUserId: string | null;
}

/** Truy van hieu luc: ap mac dinh + bo tham so khong ap dung. */
export interface ResolvedQuery {
  intent: AnswerIntent;
  period: ChatPeriod | null;
  focus: ChatFocus | null;
  /** Tham so nguoi dung CO noi nhung loai cau hoi nay khong dung -> cau tra loi ghi ro. */
  ignoredSlots: ChatSlot[];
}

/** Ky cho viec "da xong": thieu -> tuan nay; ky tuong lai -> tuan nay + ghi bo qua. */
function donePeriod(period: ChatPeriod | null, ignored: Set<ChatSlot>): ChatPeriod {
  if (period === null) return 'THIS_WEEK';
  if (isFuturePeriod(period)) {
    ignored.add('period');
    return 'THIS_WEEK';
  }
  return period;
}

/** focus da biet (khac null) -> ky ap dung ra sao (§5.2). */
function periodForFocus(
  focus: ChatFocus,
  period: ChatPeriod | null,
  ignored: Set<ChatSlot>
): ChatPeriod | null {
  switch (focus) {
    case 'OPEN':
      return period; // null = moi viec dang mo, khong loc ngay
    case 'DONE':
      return donePeriod(period, ignored);
    case 'OVERDUE':
    case 'BLOCKED':
      if (period !== null) ignored.add('period');
      return null;
  }
}

export function resolveSlots(q: FinalQuestion): ResolvedQuery {
  const ignored = new Set<ChatSlot>();
  const hasMember = q.memberText !== null || q.memberUserId !== null;
  if (q.intent !== 'MEMBER_TASKS' && hasMember) ignored.add('member');

  let period: ChatPeriod | null = null;
  let focus: ChatFocus | null = null;

  switch (q.intent) {
    case 'MY_TASKS': {
      focus = q.focus ?? 'OPEN';
      period = periodForFocus(focus, q.period, ignored);
      break;
    }
    case 'MEMBER_TASKS':
    case 'TEAM_SUMMARY': {
      if (q.focus !== null) {
        focus = q.focus;
        period = periodForFocus(focus, q.period, ignored);
      } else if (q.intent === 'MEMBER_TASKS') {
        // Tong quan mot nguoi: viec dang mo (khong loc ngay) + viec xong trong ky
        period = donePeriod(q.period, ignored);
      } else {
        // Tong ket nhom: ky tuong lai van co nghia (viec den han trong ky)
        period = q.period ?? 'THIS_WEEK';
      }
      break;
    }
    case 'MY_PRIORITIES': {
      // "Hom nay nen lam gi truoc" - "hom nay" la ngam dinh, khong bao la bo qua
      if (q.period !== null && q.period !== 'TODAY') ignored.add('period');
      if (q.focus !== null) ignored.add('focus');
      break;
    }
    case 'TEAM_WORKLOAD': {
      if (q.period !== null) ignored.add('period');
      if (q.focus !== null) ignored.add('focus');
      break;
    }
  }

  const order: ChatSlot[] = ['period', 'focus', 'member'];
  return { intent: q.intent, period, focus, ignoredSlots: order.filter((s) => ignored.has(s)) };
}
