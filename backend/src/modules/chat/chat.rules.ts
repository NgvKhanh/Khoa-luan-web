// Bo luat hieu cau hoi - nhanh B0 (CHATBOT_MODULE.md §10.1).
//
// HAM THUAN, TAT DINH, khong DB / mang / dong ho. Dau vao: cau hoi + danh sach nguoi
// (chi o server). Dau ra: cung kieu ParsedQuestion voi lop LLM, de hai nhanh doi
// chieu duoc va de gop (B2).
//
// Cach lam: tach tu (co dau + khong dau) roi so cum tu tren BAN KHONG DAU theo tung
// tu - khong regex ghep chuoi, khong ".*". Nhung tu de nham khi bo dau (đổi/đợi/đội,
// gán/gần, mời/mới, bận/bạn, tới/tôi...) chi khop dung ban co dau khi nguoi dung go
// co dau; go khong dau thi dung cum hai tu hoac bo qua.
//
// Thu tu: (1) cum chi thoi gian -> danh dau tu da dung; (2) tinh trang (focus);
// (3) ten nguoi (can dau hieu ngu canh, §8.2 buoc 5); (4) nguoi hoi tu nhac minh;
// (5) quyet dinh y dinh theo bang uu tien o cuoi tep.

import {
  MAX_QUESTION_CHARS,
  type ChatFocus,
  type ChatPeriod,
  type ParsedQuestion,
} from './chat.intent';
import { findNameSpans, isHonorific, tokenize, type RosterMember, type Token } from './chat.members';

// ===================== Khop tu / cum tu =====================

/** Tu co dau bat buoc: tu go CO dau phai trung mot dang `orig`; go khong dau thi so `fold` (neu plainOk). */
interface MarkedWord {
  fold: string;
  orig: readonly string[];
  plainOk: boolean;
}
type Word = string | MarkedWord;
type Phrase = readonly Word[];

/** Tu co dau, nhung go khong dau van chap nhan. */
function d(fold: string, ...orig: string[]): MarkedWord {
  return { fold, orig, plainOk: true };
}
/** Chi chap nhan khi go dung dau (ban khong dau qua mo ho). */
function only(...orig: string[]): MarkedWord {
  return { fold: '', orig, plainOk: false };
}

function wordMatches(t: Token, w: Word): boolean {
  if (typeof w === 'string') return t.fold === w;
  if (t.plain) return w.plainOk && t.fold === w.fold;
  return w.orig.includes(t.orig);
}

function phraseAt(toks: Token[], i: number, p: Phrase, blocked: boolean[]): boolean {
  if (i + p.length > toks.length) return false;
  for (let k = 0; k < p.length; k++) {
    if (blocked[i + k] || !wordMatches(toks[i + k], p[k])) return false;
  }
  return true;
}

function findPhrase(toks: Token[], p: Phrase, blocked: boolean[]): number {
  for (let i = 0; i < toks.length; i++) if (phraseAt(toks, i, p, blocked)) return i;
  return -1;
}

function hasAny(toks: Token[], phrases: readonly Phrase[], blocked: boolean[]): boolean {
  return phrases.some((p) => findPhrase(toks, p, blocked) >= 0);
}

function mark(mask: boolean[], start: number, len: number): void {
  for (let k = start; k < start + len; k++) mask[k] = true;
}

const TOI = d('toi', 'tới');

// ===================== (1) Thoi gian =====================

interface PeriodRule {
  period: ChatPeriod;
  phrase: Phrase;
  /** Cum "sap den han" -> dong thoi la focus OPEN. */
  dueSoon?: true;
}

// Thu tu QUAN TRONG: cum dai / cu the truoc, cum chung ("trong tuan") sau cung.
const PERIOD_RULES: readonly PeriodRule[] = [
  { period: 'NEXT_7_DAYS', phrase: ['7', 'ngay', 'sap', TOI] },
  { period: 'NEXT_7_DAYS', phrase: ['7', 'ngay', TOI] },
  { period: 'NEXT_7_DAYS', phrase: ['bay', 'ngay', TOI] },
  { period: 'NEXT_7_DAYS', phrase: ['7', 'ngay', 'nua'] },
  { period: 'NEXT_7_DAYS', phrase: ['bay', 'ngay', 'nua'] },
  { period: 'NEXT_7_DAYS', phrase: ['may', 'ngay', TOI] },
  { period: 'NEXT_7_DAYS', phrase: ['trong', '7', 'ngay'] },
  { period: 'NEXT_7_DAYS', phrase: ['sap', 'den', 'han'], dueSoon: true },
  { period: 'NEXT_7_DAYS', phrase: ['sap', TOI, 'han'], dueSoon: true },
  { period: 'NEXT_7_DAYS', phrase: ['sap', 'het', 'han'], dueSoon: true },
  { period: 'NEXT_7_DAYS', phrase: ['gan', 'den', 'han'], dueSoon: true },
  { period: 'NEXT_7_DAYS', phrase: ['sap', 'den', 'deadline'], dueSoon: true },
  { period: 'NEXT_7_DAYS', phrase: ['sap', 'han'], dueSoon: true },
  { period: 'NEXT_7_DAYS', phrase: ['sap', TOI] },
  { period: 'NEXT_WEEK', phrase: ['trong', 'tuan', 'sau'] },
  { period: 'NEXT_WEEK', phrase: ['trong', 'tuan', TOI] },
  { period: 'NEXT_WEEK', phrase: ['tuan', 'sau'] },
  { period: 'NEXT_WEEK', phrase: ['tuan', TOI] },
  { period: 'LAST_WEEK', phrase: ['tuan', 'vua', 'qua'] },
  { period: 'LAST_WEEK', phrase: ['tuan', 'vua', 'roi'] },
  { period: 'LAST_WEEK', phrase: ['tuan', 'truoc'] },
  { period: 'LAST_WEEK', phrase: ['tuan', 'qua'] },
  { period: 'LAST_WEEK', phrase: ['tuan', 'roi'] },
  { period: 'THIS_WEEK', phrase: ['trong', 'tuan', 'nay'] },
  { period: 'THIS_WEEK', phrase: ['tuan', 'nay'] },
  { period: 'THIS_WEEK', phrase: ['tuan', 'hien', 'tai'] },
  { period: 'THIS_WEEK', phrase: ['trong', 'tuan'] },
  { period: 'TODAY', phrase: ['hom', 'nay'] },
  { period: 'TOMORROW', phrase: ['ngay', 'mai'] },
  { period: 'TOMORROW', phrase: ['sang', 'mai'] },
  { period: 'TOMORROW', phrase: ['chieu', 'mai'] },
  { period: 'TOMORROW', phrase: ['trua', 'mai'] },
  { period: 'TOMORROW', phrase: [d('toi', 'tối'), 'mai'] },
];

/** Moi cum chiem tu chua bi chiem; chon cum xuat hien SOM NHAT trong cau. */
function detectPeriod(toks: Token[], used: boolean[]): { period: ChatPeriod | null; dueSoon: boolean } {
  let best: { start: number; rule: PeriodRule } | null = null;
  let dueSoon = false;
  for (const rule of PERIOD_RULES) {
    for (let i = 0; i < toks.length; i++) {
      if (!phraseAt(toks, i, rule.phrase, used)) continue;
      mark(used, i, rule.phrase.length);
      if (rule.dueSoon) dueSoon = true;
      if (best === null || i < best.start) best = { start: i, rule };
    }
  }
  return { period: best?.rule.period ?? null, dueSoon };
}

// ===================== (2) Tinh trang =====================

interface FocusRule {
  focus: ChatFocus;
  phrase: Phrase;
  /** Bo qua neu tu ke tiep la mot trong cac tu nay (vd "kết thúc", "kết quả"). */
  unlessNext?: readonly string[];
}

// Thu tu: phu dinh ("chua xong" = dang mo) truoc "xong".
const FOCUS_RULES: readonly FocusRule[] = [
  { focus: 'OPEN', phrase: ['chua', 'lam', 'xong'] },
  { focus: 'OPEN', phrase: ['chua', 'hoan', 'thanh'] },
  { focus: 'OPEN', phrase: ['chua', 'hoan', 'tat'] },
  { focus: 'OPEN', phrase: ['chua', 'xong'] },
  { focus: 'DONE', phrase: ['hoan', 'thanh'] },
  { focus: 'DONE', phrase: ['hoan', 'tat'] },
  { focus: 'DONE', phrase: ['xong'] },
  { focus: 'OVERDUE', phrase: ['qua', 'han'] },
  { focus: 'OVERDUE', phrase: ['tre', 'han'] },
  { focus: 'OVERDUE', phrase: ['lo', 'han'] },
  { focus: 'OVERDUE', phrase: ['het', 'han'] },
  { focus: 'OVERDUE', phrase: ['qua', 'deadline'] },
  { focus: 'OVERDUE', phrase: ['tre', 'deadline'] },
  { focus: 'OVERDUE', phrase: ['bi', 'tre'] },
  { focus: 'OVERDUE', phrase: [d('tre', 'trễ')] },
  { focus: 'BLOCKED', phrase: ['can', 'go', 'chan'] },
  { focus: 'BLOCKED', phrase: ['bi', 'chan'] },
  { focus: 'BLOCKED', phrase: ['bi', 'block'] },
  { focus: 'BLOCKED', phrase: ['blocked'] },
  { focus: 'BLOCKED', phrase: ['block'] },
  { focus: 'BLOCKED', phrase: [d('chan', 'chặn')] },
  { focus: 'BLOCKED', phrase: [d('vuong', 'vướng')] },
  { focus: 'BLOCKED', phrase: [d('ket', 'kẹt')], unlessNext: ['thuc', 'qua', 'noi', 'luan'] },
  { focus: 'BLOCKED', phrase: [d('tac', 'tắc')] },
  { focus: 'OPEN', phrase: ['dang', 'thuc', 'hien'] },
  { focus: 'OPEN', phrase: ['dang', 'xu', 'ly'] },
  { focus: 'OPEN', phrase: ['dang', 'lam'] },
  { focus: 'OPEN', phrase: ['dang', 'giu'] },
  { focus: 'OPEN', phrase: ['dang', 'mo'] },
  { focus: 'OPEN', phrase: ['con', 'lai'] },
  { focus: 'OPEN', phrase: ['can', 'lam'] },
  { focus: 'OPEN', phrase: ['phai', 'lam'] },
  { focus: 'OPEN', phrase: ['chua', 'lam'] },
];

function detectFocus(toks: Token[], periodUsed: boolean[], dueSoon: boolean): ChatFocus | null {
  const used = [...periodUsed];
  const found = new Set<ChatFocus>();
  if (dueSoon) found.add('OPEN');
  for (const rule of FOCUS_RULES) {
    for (let i = 0; i < toks.length; i++) {
      if (!phraseAt(toks, i, rule.phrase, used)) continue;
      const next = toks[i + rule.phrase.length];
      if (rule.unlessNext && next && rule.unlessNext.includes(next.fold)) continue;
      mark(used, i, rule.phrase.length);
      found.add(rule.focus);
    }
  }
  if (found.size === 0) return null;
  if (found.size === 1) return [...found][0];
  // "viec chua xong nao qua han" -> cu the hon thang; cac to hop khac -> hoi tong quan
  if (found.size === 2 && found.has('OPEN')) {
    if (found.has('OVERDUE')) return 'OVERDUE';
    if (found.has('BLOCKED')) return 'BLOCKED';
  }
  return null;
}

// ===================== (3) Ten nguoi =====================

const PRE_CUES = new Set(['cua', 'cho', 'voi', 'con', 'ban', 'anh', 'chi', 'em', 'co', 'chu', 'thay', 'bac', 'be', 'ong']);
const POST_CUES = new Set([
  'dang', 'lam', 'xong', 'co', 'da', 'con', 'nhan', 'giu', 'thi', 'bi', 'sap', 'hien', 'van', 'duoc', 'can',
  'phai', 'nen',
]);
const TIME_HEADS = new Set(['tuan', 'thang', 'nam', 'ngay', 'hom', 'gio']);
const TIME_MODS = new Set(['nay', 'sau', 'toi', 'truoc', 'qua', 'roi', 'kia', 'mot', 'nua', 'ay', 'do']);
const NUMBER_WORDS = new Set(['mot', 'hai', 'ba', 'bon', 'nam', 'sau', 'bay', 'tam', 'chin', 'muoi', 'may', 'vai']);
const MAI_PREV = new Set(['ngay', 'sang', 'chieu', 'toi', 'trua', 'dem']);
const SELF_FOLDS = new Set(['toi', 'minh', 'to', 'em']);
const DIGITS_RE = /^[0-9]{1,4}$/;

function isCapitalized(raw: string): boolean {
  const first = raw.charAt(0);
  return first !== first.toLowerCase();
}

/**
 * Doan [s, e) trung ten co thuc su la nhac toi nguoi? (§8.2 buoc 5)
 * `questionPlain`: ca cau go khong dau -> "minh"/"toi" nhieu kha nang la "mình"/"tôi".
 */
function acceptNameSpan(toks: Token[], s: number, e: number, questionPlain: boolean): boolean {
  const first = toks[s];
  const last = toks[e - 1];
  const prev = s > 0 ? toks[s - 1] : undefined;
  const next = e < toks.length ? toks[e] : undefined;
  const single = e - s === 1;
  const capitalizedMid = s > 0 && isCapitalized(first.raw);

  // Cum thoi gian: "tuần sau" (Tuấn), "năm nay" (Nam), "3 tuần", "ngày mai" (Mai)
  if (next && TIME_HEADS.has(last.fold) && TIME_MODS.has(next.fold)) return false;
  if (prev && TIME_HEADS.has(first.fold) && (DIGITS_RE.test(prev.raw) || NUMBER_WORDS.has(prev.fold))) return false;
  if (first.fold === 'mai' && prev && MAI_PREV.has(prev.fold)) return false;
  // "mình"/"tôi" go CO DAU khong bao gio la ten (ten "Minh" luu khong dau van so khop ban bo dau);
  // "cua minh" (ca cau khong dau) = "của mình"; "anh ấy" khong phai ten "Tuấn Anh"
  if (single && (first.orig === 'mình' || first.orig === 'tôi' || first.orig === 'tớ')) return false;
  if (single && questionPlain && SELF_FOLDS.has(first.fold) && !capitalizedMid) return false;
  if (single && isHonorific(first) && !capitalizedMid && !(s === 0 && e === toks.length)) return false;

  if (s === 0 && e === toks.length) return true; // ca cau chi la mot ten: "Lan?"
  if (prev && PRE_CUES.has(prev.fold)) return true;
  if (next && POST_CUES.has(next.fold)) return true;
  return capitalizedMid; // ten rieng viet hoa giua cau
}

/** Doan ten duoc chap nhan: dai nhat, roi som nhat; khong de len cum thoi gian. */
function detectName(
  toks: Token[],
  roster: readonly RosterMember[],
  periodUsed: boolean[]
): { start: number; end: number } | null {
  const questionPlain = toks.every((t) => t.plain);
  let best: { start: number; end: number } | null = null;
  for (const span of findNameSpans(toks, roster)) {
    if (periodUsed.slice(span.start, span.end).some(Boolean)) continue;
    if (!acceptNameSpan(toks, span.start, span.end, questionPlain)) continue;
    const len = span.end - span.start;
    if (best === null || len > best.end - best.start || (len === best.end - best.start && span.start < best.start)) {
      best = { start: span.start, end: span.end };
    }
  }
  return best;
}

// ===================== (4) Nguoi hoi tu nhac minh =====================

function detectSelf(toks: Token[], periodUsed: boolean[], name: { start: number; end: number } | null): boolean {
  // "toi"/"minh" khong dau chi la nguoi hoi khi CA CAU go khong dau (go co dau thi da viet "tôi"/"mình")
  const questionPlain = toks.every((t) => t.plain);
  for (let i = 0; i < toks.length; i++) {
    if (periodUsed[i] || (name && i >= name.start && i < name.end)) continue;
    const t = toks[i];
    if (t.orig === 'tôi' || t.orig === 'mình' || t.orig === 'tớ') return true;
    if (questionPlain && t.fold === 'toi') return true;
    if (questionPlain && t.fold === 'minh' && !(i > 0 && isCapitalized(t.raw))) return true;
    if (t.fold === 'em' && !(name && name.start === i + 1)) return true;
  }
  return findPhrase(toks, ['ban', 'than'], periodUsed) >= 0;
}

// ===================== (5) Tin hieu y dinh =====================

interface ActionRule {
  phrase: Phrase;
  unlessPrev?: readonly string[];
  unlessNext?: readonly string[];
}

/** Yeu cau THAO TAC -> UNSUPPORTED (ban dau chi doc). */
const ACTION_RULES: readonly ActionRule[] = [
  { phrase: [d('tao', 'tạo')] },
  { phrase: [d('them', 'thêm')] },
  { phrase: [d('xoa', 'xoá', 'xóa')] },
  { phrase: [d('sua', 'sửa')] },
  { phrase: [only('đổi')] },
  { phrase: ['doi', 'han'] },
  { phrase: ['doi', 'ten'] },
  { phrase: ['doi', 'trang', 'thai'] },
  { phrase: ['doi', 'nguoi'] },
  { phrase: [only('chuyển')] },
  { phrase: ['chuyen', 'the'] },
  { phrase: ['chuyen', 'sang'] },
  { phrase: ['chuyen', 'viec'] },
  { phrase: [only('gán')] },
  { phrase: [only('mời')] },
  { phrase: [only('huỷ', 'hủy')] },
  { phrase: ['giao'], unlessPrev: ['duoc', 'chua', 'da', 'bi', 'dang'], unlessNext: ['dien', 'tiep', 'luu'] },
  { phrase: ['danh', 'dau'] },
  { phrase: ['cap', 'nhat'] },
  { phrase: ['dat', 'han'] },
  { phrase: ['dat', 'lich'] },
  { phrase: ['len', 'lich'] },
  { phrase: ['luu', 'tru'] },
  { phrase: ['nhac', 'nho'] },
];

/** Hoi thong tin ngoai pham vi ban dau (email, hoso...) -> UNSUPPORTED. */
const OUT_OF_SCOPE: readonly Phrase[] = [
  ['email'],
  ['mail'],
  ['gmail'],
  ['so', 'dien', 'thoai'],
  ['sdt'],
  ['mat', 'khau'],
  ['password'],
  ['dia', 'chi'],
  [only('lương')],
  ['ho', 'so'],
  ['cv'],
  ['ky', 'nang'],
];

const PRIORITY: readonly Phrase[] = [
  ['uu', 'tien'],
  ['gap', 'nhat'],
  ['quan', 'trong', 'nhat'],
  ['bat', 'dau', 'tu'],
  ['lam', 'truoc'],
  ['xu', 'ly', 'truoc'],
  ['lam', 'gi', 'truoc'],
  ['viec', 'gi', 'truoc'],
  ['cai', 'nao', 'truoc'],
  ['truoc', 'tien'],
  ['nen', 'lam'],
  ['nen', 'xu', 'ly'],
  ['nen', 'bat', 'dau'],
  ['nen', 'tap', 'trung'],
];

/** Luong viec giua cac nguoi: can "ai" + tu chi so luong, hoac "moi nguoi" + "bao nhieu"... */
const WORKLOAD_WITH_AI: readonly Phrase[] = [
  ['nhieu'],
  ['it'],
  [only('bận')],
  [d('ranh', 'rảnh')],
  ['qua', 'tai'],
  [d('om', 'ôm')],
];
const WORKLOAD_WITH_EVERYONE: readonly Phrase[] = [
  ['bao', 'nhieu'],
  ['so', 'viec'],
  ['dang', 'giu'],
  ['dang', 'co'],
  [d('giu', 'giữ')],
];
const WORKLOAD_ALONE: readonly Phrase[] = [
  ['khoi', 'luong'],
  ['tai', 'cong', 'viec'],
  ['phan', 'bo'],
  ['nhieu', 'viec', 'nhat'],
  ['it', 'viec', 'nhat'],
  ['qua', 'tai'],
];
const EVERYONE: Phrase = ['moi', 'nguoi'];

const TEAM_STRONG: readonly Phrase[] = [
  ['nhom'],
  ['team'],
  [only('đội')],
  ['ca', 'doi'],
  ['du', 'an'],
  [d('bang', 'bảng'), 'nay'],
  ['workspace'],
  ['khong', 'gian'],
  EVERYONE,
  ['thanh', 'vien'],
  ['chua', 'giao'],
  ['chua', 'duoc', 'giao'],
  ['chua', 'co', 'nguoi'],
  ['chua', 'ai', 'nhan'],
  ['chua', 'phan', 'cong'],
];
/** Chi tinh la "nhom" khi nguoi hoi khong tu nhac minh ("tiến độ của tôi" la viec ca nhan). */
const TEAM_WEAK: readonly Phrase[] = [['tien', 'do'], ['tong', 'ket'], ['bao', 'cao'], ['tinh', 'hinh']];

const TASK_WORDS: readonly Phrase[] = [
  ['viec'],
  ['task'],
  ['tasks'],
  ['deadline'],
  ['han', 'chot'], // "hạn" mot minh nam trong "quá hạn", "sắp đến hạn" -> khong tinh
  ['nhiem', 'vu'],
  [only('thẻ')],
  ['card'],
];

function detectAction(toks: Token[], blocked: boolean[]): boolean {
  for (const rule of ACTION_RULES) {
    for (let i = 0; i < toks.length; i++) {
      if (!phraseAt(toks, i, rule.phrase, blocked)) continue;
      const prev = toks[i - 1];
      const next = toks[i + rule.phrase.length];
      if (rule.unlessPrev && prev && rule.unlessPrev.includes(prev.fold)) continue;
      if (rule.unlessNext && next && rule.unlessNext.includes(next.fold)) continue;
      return true;
    }
  }
  return false;
}

function detectWorkload(toks: Token[], blocked: boolean[]): boolean {
  if (hasAny(toks, WORKLOAD_ALONE, blocked)) return true;
  const hasAi = toks.some((t, i) => !blocked[i] && t.orig === 'ai');
  if (hasAi && hasAny(toks, WORKLOAD_WITH_AI, blocked)) return true;
  return findPhrase(toks, EVERYONE, blocked) >= 0 && hasAny(toks, WORKLOAD_WITH_EVERYONE, blocked);
}

/** "còn …", "thế còn …", "vậy còn …" o dau cau hoac "… thì sao" o cuoi cau. */
function detectFollowUpMarker(toks: Token[]): boolean {
  const none: boolean[] = [];
  const CON = d('con', 'còn');
  const THE = d('the', 'thế');
  if (phraseAt(toks, 0, [CON], none)) return true;
  if (phraseAt(toks, 0, [THE, CON], none) || phraseAt(toks, 0, ['vay', CON], none)) return true;
  if (phraseAt(toks, 0, [THE, 'thi'], none)) return true;
  const n = toks.length;
  return (n >= 2 && phraseAt(toks, n - 2, ['thi', 'sao'], none)) || (n >= 3 && phraseAt(toks, n - 3, ['thi', 'the', 'nao'], none));
}

const SELF_MARKER = 'tôi';

// ===================== Ket qua =====================

export function parseByRules(question: string, roster: readonly RosterMember[]): ParsedQuestion {
  const toks = tokenize(question.slice(0, MAX_QUESTION_CHARS));
  const periodUsed: boolean[] = toks.map(() => false);

  const { period: detectedPeriod, dueSoon } = detectPeriod(toks, periodUsed);
  const focus = detectFocus(toks, periodUsed, dueSoon);
  const name = detectName(toks, roster, periodUsed);
  const self = detectSelf(toks, periodUsed, name);

  // "mai" dung mot minh (khong phai ten ai) = ngay mai
  let period = detectedPeriod;
  if (period === null) {
    const i = toks.findIndex((t, k) => t.orig === 'mai' && !periodUsed[k] && !(name && k >= name.start && k < name.end));
    if (i >= 0) period = 'TOMORROW';
  }

  const member = name ? toks.slice(name.start, name.end).map((t) => t.orig).join(' ') : null;
  const unsupported: ParsedQuestion = { intent: 'UNSUPPORTED', period: null, focus: null, member: null };

  if (hasAny(toks, OUT_OF_SCOPE, periodUsed) || detectAction(toks, periodUsed)) return unsupported;
  if (detectWorkload(toks, periodUsed)) return { intent: 'TEAM_WORKLOAD', period, focus, member: null };

  const taskWords = hasAny(toks, TASK_WORDS, periodUsed);
  const team = hasAny(toks, TEAM_STRONG, periodUsed) || (!self && hasAny(toks, TEAM_WEAK, periodUsed));

  if (hasAny(toks, PRIORITY, periodUsed)) {
    return member
      ? { intent: 'MEMBER_TASKS', period, focus, member }
      : { intent: 'MY_PRIORITIES', period, focus, member: null };
  }
  // "còn Minh?", "còn tuần sau thì sao?", "còn tôi?" -> chi bo sung tham so
  const hasSlot = period !== null || focus !== null || member !== null || self;
  if (detectFollowUpMarker(toks) && !taskWords && !team && hasSlot) {
    return { intent: 'NONE', period, focus, member: member ?? (self ? SELF_MARKER : null) };
  }
  if (member) return { intent: 'MEMBER_TASKS', period, focus, member };
  if (team) return { intent: 'TEAM_SUMMARY', period, focus, member: null };
  if (self || taskWords || focus !== null) return { intent: 'MY_TASKS', period, focus, member: null };
  if (period !== null) return { intent: 'NONE', period, focus: null, member: null };
  return unsupported;
}
