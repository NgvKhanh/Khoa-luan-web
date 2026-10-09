// Chu tieng Viet cho lop HANH DONG: tach tu khong dau, bang dong tu "giay phep", tu khoa trang thai, cum "giao cho du lieu",
// phu dinh, dau hieu cau hoi. HAM THUAN: khong DB, khong dong ho, khong mang. Quy uoc nhu ai.rules.ts: moi regex la hang
// literal, khong ghep chuoi vao regex; bo tach quet MOT LAN theo tung ky tu.
//
// Muc dich chung (CHATBOT_V2_ACTIONS_PLAN.md §5): phan biet DU LIEU (ten the, ten cot... chi dung de TIM doi tuong) voi CHI DAN
// (nguon cua hanh dong). Mot thao tac chi duoc xem la "lenh truc tiep cua nguoi dung" khi chinh cau cua ho co dong tu tuong ung
// va chua cac chu ma thao tac dung.

import type { CardStatus } from '../../../../generated/prisma/enums';
import { foldText, normalizeText } from '../../../ai/ai.rules';
import { tokenize } from '../../chat.members';

export type Phrase = readonly string[];

/** Tach cau thanh cac tu: chu thuong, bo dau tieng Viet, chi giu a-z0-9. */
export function foldWords(input: string): string[] {
  const out: string[] = [];
  let cur = '';
  for (const ch of foldText(normalizeText(input))) {
    const c = ch.charCodeAt(0);
    if ((c >= 97 && c <= 122) || (c >= 48 && c <= 57)) {
      cur += ch;
    } else if (cur !== '') {
      out.push(cur);
      cur = '';
    }
  }
  if (cur !== '') out.push(cur);
  return out;
}

/** Vi tri bat dau cua MOI lan `phrase` xuat hien LIEN TIEP trong `words`. */
export function phraseIndexes(words: readonly string[], phrase: Phrase): number[] {
  const out: number[] = [];
  if (phrase.length === 0) return out;
  for (let i = 0; i + phrase.length <= words.length; i += 1) {
    let ok = true;
    for (let k = 0; k < phrase.length; k += 1) {
      if (words[i + k] !== phrase[k]) {
        ok = false;
        break;
      }
    }
    if (ok) out.push(i);
  }
  return out;
}

export function hasPhrase(words: readonly string[], phrase: Phrase): boolean {
  return phraseIndexes(words, phrase).length > 0;
}

export function hasAny(words: readonly string[], phrases: readonly Phrase[]): boolean {
  return phrases.some((p) => hasPhrase(words, p));
}

function indexesOfAny(words: readonly string[], phrases: readonly Phrase[]): number[] {
  return phrases.flatMap((p) => phraseIndexes(words, p)).sort((a, b) => a - b);
}

// ===================== Dong tu "giay phep" theo loai thao tac =====================
// Chi la dong tu chi VIEC LAM (khong phai ten rieng): "chuyen", "giao", "doi han"... Chu da bo dau, thuong.

const CREATE_VERBS: readonly Phrase[] = [['tao'], ['them'], ['add'], ['create'], ['new'], ['bo', 'sung'], ['lap']];
const LIST_NOUNS: readonly Phrase[] = [['cot'], ['list'], ['danh', 'sach'], ['column']];
/** Dong tu tao phai dung SAT danh tu "cot" (toi da 3 tu: "tao cot", "them mot cot moi"): "them 3 task vao cot X" khong phai lenh tao cot. */
const CREATE_LIST_SPAN = 3;
const RENAME_VERBS: readonly Phrase[] = [
  ['doi', 'ten'],
  ['sua', 'ten'],
  ['rename'],
  ['doi', 'tieu', 'de'],
  ['sua', 'tieu', 'de'],
  ['dat', 'ten'],
  ['goi', 'la'],
  ['doi', 'thanh'],
  ['sua', 'thanh'],
];
const DUE_VERBS: readonly Phrase[] = [
  ['deadline'],
  ['han'],
  ['due'],
  ['gia', 'han'],
  ['dat', 'han'],
  ['doi', 'han'],
  ['bo', 'han'],
  ['xoa', 'han'],
  ['huy', 'han'],
  ['go', 'han'],
];
const MOVE_VERBS: readonly Phrase[] = [['chuyen'], ['di', 'chuyen'], ['dua'], ['keo'], ['move'], ['dat', 'vao'], ['dat', 'sang']];
const ASSIGN_VERBS: readonly Phrase[] = [['giao'], ['gan'], ['assign'], ['phan', 'cong'], ['chi', 'dinh']];
// Phase 6: chia viec cho CA COT. Phai co dong tu chia / giao / phan cong VA dau hieu "chua co nguoi" (neu khong thi "giao Login cho Lan" khong the bi doi thanh chia ca cot).
const SPLIT_VERBS: readonly Phrase[] = [['chia'], ['giao'], ['phan', 'cong'], ['phan', 'bo'], ['assign']];
const UNASSIGNED_CUES: readonly Phrase[] = [
  ['chua', 'co', 'nguoi'],
  ['chua', 'giao'],
  ['chua', 'duoc', 'giao'],
  ['chua', 'phan', 'cong'],
  ['chua', 'duoc', 'phan', 'cong'],
  ['khong', 'co', 'nguoi'],
  ['chua', 'co', 'ai'],
  ['chua', 'ai'],
  ['con', 'trong'],
];
/** Cau nho chon "nguoi phu hop nhat" (khong goi ten): chi khi co cum nay thi {by:BEST} moi duoc chap nhan. */
const BEST_CUES: readonly Phrase[] = [['phu', 'hop'], ['thich', 'hop'], ['tot', 'nhat'], ['hop', 'nhat'], ['xung', 'dang'], ['ai', 'lam', 'duoc'], ['dung', 'nguoi'], ['goi', 'y']];
export const hasBestCue = (words: readonly string[]): boolean => hasAny(words, BEST_CUES);
const LABEL_WORDS: readonly Phrase[] = [['nhan'], ['label'], ['tag']];
const LABEL_VERBS: readonly Phrase[] = [['them'], ['gan'], ['dan'], ['add'], ['dat'], ['cho'], ['gui']];
const STATUS_VERBS: readonly Phrase[] = [
  ['chuyen'],
  ['doi'],
  ['dat'],
  ['danh', 'dau'],
  ['mark'],
  ['set'],
  ['cap', 'nhat'],
  ['trang', 'thai'],
  ['sang'],
  ['thanh'],
  ['la'],
];

// ===================== Trang thai =====================
// SAO Y GUESS_RULES o card/cardStatus.ts (khong export) - test chat.actions.pure canh de hai ban khong lech.

export const STATUS_ORDER: readonly CardStatus[] = ['IN_REVIEW', 'BLOCKED', 'TODO', 'IN_PROGRESS', 'DONE'];
export const STATUS_PHRASES: Record<CardStatus, readonly Phrase[]> = {
  IN_REVIEW: [['cho', 'duyet'], ['review'], ['kiem', 'thu'], ['kiem', 'tra'], ['testing'], ['qa'], ['phan', 'hoi']],
  BLOCKED: [['bi', 'chan'], ['tam', 'hoan'], ['tam', 'dung'], ['dang', 'cho'], ['blocked'], ['on', 'hold']],
  TODO: [['chua', 'lam'], ['chua', 'xong'], ['chua', 'hoan', 'thanh'], ['chua', 'bat', 'dau'], ['can', 'lam'], ['to', 'do'], ['todo'], ['backlog']],
  IN_PROGRESS: [
    ['dang', 'lam'],
    ['dang', 'thuc', 'hien'],
    ['dang', 'xu', 'ly'],
    ['dang', 'viet'],
    ['dang', 'nghien', 'cuu'],
    ['dang', 'phat', 'trien'],
    ['in', 'progress'],
    ['doing'],
  ],
  DONE: [['hoan', 'thanh'], ['hoan', 'tat'], ['xong'], ['done'], ['da', 'dang'], ['completed'], ['finished']],
};

export interface StatusMention {
  status: CardStatus;
  start: number;
  end: number;
}

/**
 * Moi lan nguoi dung nhac toi mot trang thai. Hai cum chong lan ("chua hoan thanh" chua "hoan thanh") -> giu cum DAI hon;
 * bang nhau -> cum dung truoc theo STATUS_ORDER (nhu GUESS_RULES). Ket qua sap theo vi tri.
 */
export function statusMentions(words: readonly string[]): StatusMention[] {
  const all: Array<StatusMention & { rank: number }> = [];
  for (const [rank, status] of STATUS_ORDER.entries()) {
    for (const phrase of STATUS_PHRASES[status]) {
      for (const start of phraseIndexes(words, phrase)) all.push({ status, start, end: start + phrase.length, rank });
    }
  }
  all.sort((a, b) => b.end - b.start - (a.end - a.start) || a.rank - b.rank || a.start - b.start);
  const kept: StatusMention[] = [];
  for (const m of all) {
    if (!kept.some((k) => m.start < k.end && k.start < m.end)) kept.push({ status: m.status, start: m.start, end: m.end });
  }
  return kept.sort((a, b) => a.start - b.start);
}

/** Trang thai duoc nhac CUOI CUNG trong cau ("tu Dang lam sang Xong" -> DONE), null neu khong nhac. */
export function lastStatusMention(words: readonly string[]): CardStatus | null {
  const all = statusMentions(words);
  return all.length === 0 ? null : all[all.length - 1].status;
}

// ===================== Phu dinh + giay phep =====================

const NEGATORS: readonly Phrase[] = [['dung'], ['khoi'], ['khong'], ['chua', 'can'], ['khong', 'can'], ['khong', 'duoc'], ['khong', 'nen'], ['cam']];

/** Mot phu dinh nam NGAY TRUOC vi tri `at` (cach toi da 1 tu: "dung chuyen", "khong can phai chuyen"). */
function negatedAt(words: readonly string[], at: number): boolean {
  for (const neg of NEGATORS) {
    for (const start of phraseIndexes(words, neg)) {
      const end = start + neg.length;
      if (end <= at && at - end <= 1) return true;
    }
  }
  return false;
}

export interface Licence {
  /** Co it nhat mot dong tu cho phep thao tac nay trong cau (chua xet phu dinh). */
  licensed: boolean;
  /** Moi lan xuat hien dong tu deu bi phu dinh ("dung chuyen ..."). */
  negated: boolean;
}

/**
 * "Giay phep dong tu": cau cua NGUOI DUNG co dong tu cho loai thao tac nay khong? Thao tac khong co dong tu trong cau
 * (vd mo ta the bao "giao het cho X" + cau hoi binh thuong) khong bao gio duoc tu chay.
 */
export function licenceFor(type: string, words: readonly string[], status?: CardStatus, strictLast = true): Licence {
  let at: number[] = [];
  switch (type) {
    case 'CREATE_LIST': {
      const nouns = indexesOfAny(words, LIST_NOUNS);
      at = indexesOfAny(words, CREATE_VERBS).filter((v) => nouns.some((n) => n > v && n - v <= CREATE_LIST_SPAN));
      break;
    }
    case 'CREATE_CARD':
      at = indexesOfAny(words, CREATE_VERBS);
      break;
    case 'RENAME_CARD':
      at = indexesOfAny(words, RENAME_VERBS);
      break;
    case 'SET_CARD_DUE':
      at = indexesOfAny(words, DUE_VERBS);
      break;
    case 'MOVE_CARD':
      at = indexesOfAny(words, MOVE_VERBS);
      break;
    case 'ASSIGN_MEMBER': {
      at = indexesOfAny(words, ASSIGN_VERBS);
      // "them Minh vao task Frontend": dong tu "them" + "vao"
      if (hasPhrase(words, ['vao'])) at = [...at, ...phraseIndexes(words, ['them'])].sort((a, b) => a - b);
      break;
    }
    case 'ASSIGN_UNASSIGNED':
      at = hasAny(words, UNASSIGNED_CUES) ? indexesOfAny(words, SPLIT_VERBS) : [];
      break;
    case 'ADD_LABEL':
      // phai nhac toi nhan (nhan/label/tag) VA co dong tu gan / them / dan...
      at = hasAny(words, LABEL_WORDS) ? indexesOfAny(words, LABEL_VERBS) : [];
      break;
    case 'SET_CARD_STATUS': {
      // trang thai muc tieu phai la trang thai DUOC NHAC CUOI ("tu Dang lam sang Xong" -> Xong); can dong tu (tru DONE: "xong" tu no
      // da la lenh). Ke hoach co NHIEU thao tac doi trang thai ("Login la dang lam, Register la xong") thi chi can duoc nhac den (strictLast = false).
      if (status === undefined) return { licensed: false, negated: false };
      const mentioned = strictLast ? lastStatusMention(words) === status : statusMentions(words).some((m) => m.status === status);
      if (!mentioned) return { licensed: false, negated: false };
      at = indexesOfAny(words, STATUS_VERBS);
      if (at.length === 0 && status === 'DONE') at = statusMentions(words).filter((m) => m.status === 'DONE').map((m) => m.start);
      break;
    }
    default:
      return { licensed: false, negated: false };
  }
  if (at.length === 0) return { licensed: false, negated: false };
  return { licensed: true, negated: at.every((i) => negatedAt(words, i)) };
}

// ===================== "Lam theo noi dung trong du lieu" =====================

const DELEGATION_STRONG: readonly Phrase[] = [
  ['lam', 'theo'],
  ['thuc', 'hien', 'theo'],
  ['ap', 'dung', 'theo'],
  ['tuan', 'theo'],
  ['lam', 'dung', 'theo'],
  ['lam', 'nhu'],
  ['lam', 'dung', 'nhu'],
];
const DELEGATION_WEAK: readonly Phrase[] = [['lam'], ['thuc', 'hien'], ['ap', 'dung'], ['theo'], ['nhu'], ['xu', 'ly']];
const DATA_NOUNS: readonly Phrase[] = [
  ['noi', 'dung'],
  ['mo', 'ta'],
  ['chi', 'dan'],
  ['huong', 'dan'],
  ['binh', 'luan'],
  ['ghi', 'chu'],
  ['comment'],
  ['description'],
  ['instruction'],
  ['yeu', 'cau', 'trong'],
];
const DATA_OBJECTS: readonly Phrase[] = [['the'], ['card'], ['task'], ['viec'], ['tep'], ['file'], ['tai', 'lieu']];

/**
 * Nguoi dung giao quyen cho DU LIEU: "lam theo noi dung card nay", "thuc hien nhu mo ta", "xu ly theo binh luan"... Chi dan khi do
 * khong phai cua nguoi dung ma nam trong the / tep / binh luan -> khong bao gio tu chay, luon cho xem truoc.
 */
export function delegatesToData(words: readonly string[]): boolean {
  const near = (verbAt: number, nouns: readonly Phrase[], span: number) =>
    indexesOfAny(words, nouns).some((j) => j > verbAt && j - verbAt <= span);
  for (const verb of DELEGATION_STRONG) {
    for (const i of phraseIndexes(words, verb)) {
      if (near(i + verb.length - 1, [...DATA_NOUNS, ...DATA_OBJECTS], 4)) return true;
    }
  }
  for (const verb of DELEGATION_WEAK) {
    for (const i of phraseIndexes(words, verb)) {
      if (near(i + verb.length - 1, DATA_NOUNS, 5)) return true;
    }
  }
  return false;
}

// ===================== Dau hieu cau hoi / cau nho =====================

const REQUEST_MARKERS: readonly Phrase[] = [
  ['giup'],
  ['ho'],
  ['nhe'],
  ['nha'],
  ['di'],
  ['lam', 'on'],
  ['vui', 'long'],
  ['co', 'the'],
  ['duoc', 'khong'],
  ['hay'],
  ['xin'],
];

/** Cau co dang cau hoi ("Co nen chuyen ... khong?") ma khong co dau hieu nho ("giup", "nhe", "di"...). */
export function isQuestionForm(raw: string, words: readonly string[]): boolean {
  const asked =
    raw.includes('?') || words[words.length - 1] === 'khong' || hasPhrase(words.slice(0, 2), ['co', 'nen']) || words[0] === 'lieu';
  return asked && !hasAny(words, REQUEST_MARKERS);
}

// ===================== Tham chieu: tu chung, "no", "toi" =====================

/** Danh tu chung dung truoc ten ("task Login", "cot Dang lam", "nhan Backend"): bo khi so khop. */
export const GENERIC_WORDS: ReadonlySet<string> = new Set([
  'task',
  'tasks',
  'card',
  'cards',
  'the',
  'viec',
  'cong',
  'cot',
  'danh',
  'sach',
  'list',
  'nhan',
  'label',
  'thanh',
  'vien',
  'anh',
  'chi',
  'ban',
  'nhiem',
  'vu',
  'ticket',
  'bang',
  'board',
]);

/** Bo cac tu chung o DAU chuoi (giu lai it nhat 1 tu); giu nguyen chu va dau cua phan con lai. */
export function stripLeadingGeneric(text: string): string {
  const tokens = tokenize(text);
  let i = 0;
  while (i < tokens.length - 1 && GENERIC_WORDS.has(tokens[i].fold)) i += 1;
  return tokens
    .slice(i)
    .map((t) => t.raw)
    .join(' ');
}

const CONTEXT_CUES: Record<'LAST_CARD' | 'LAST_LIST' | 'LAST_MEMBER', readonly Phrase[]> = {
  LAST_CARD: [['no'], ['nay'], ['do'], ['kia'], ['vua', 'roi'], ['cai', 'do'], ['cai', 'nay']],
  LAST_LIST: [['no'], ['do'], ['nay'], ['vua', 'roi'], ['cai', 'do']],
  LAST_MEMBER: [['no'], ['ho'], ['nguoi', 'do'], ['nguoi', 'nay'], ['anh', 'ay'], ['chi', 'ay'], ['ban', 'ay'], ['vua', 'roi']],
};

/** Cau co chu chi "no / the do / cai nay / vua roi" cho loai tham chieu ngu canh nay khong? */
export function hasContextCue(slot: 'LAST_CARD' | 'LAST_LIST' | 'LAST_MEMBER', words: readonly string[]): boolean {
  return hasAny(words, CONTEXT_CUES[slot]);
}

/**
 * Cau co goi chinh nguoi hoi ("toi", "minh" CO DAU, "to", "tui") khong? "minh" KHONG DAU khong tinh: no trung ten rieng
 * "Minh" (LLM tra {by:SELF} cho "giao cho Minh" se gan nham nguoi dung).
 */
export function hasSelfCue(raw: string): boolean {
  for (const t of tokenize(raw)) {
    if (t.orig === 'tôi' || t.orig === 'toi' || t.orig === 'tui' || t.orig === 'tớ' || t.orig === 'mình') return true;
  }
  return hasPhrase(foldWords(raw), ['ban', 'than']);
}

/** Cac tu cua `text` (khong dau, bo tu chung) co nam trong `words` khong? `ratio` = ty le token toi thieu phai co mat. */
export function groundedIn(text: string, words: readonly string[], ratio = 0.8, skipGeneric = true): boolean {
  let tokens = foldWords(text);
  if (skipGeneric) {
    const meaningful = tokens.filter((t) => !GENERIC_WORDS.has(t));
    if (meaningful.length > 0) tokens = meaningful;
  }
  if (tokens.length === 0) return false;
  const have = new Set(words);
  const hit = tokens.filter((t) => have.has(t)).length;
  return hit / tokens.length >= ratio;
}

// ===================== Board Patch (Phase 3): cau YEU CAU mo rong bang =====================
// Board Patch khong co "ten the / ten cot" do nguoi dung go (noi dung do AI de xuat), nen nguon cua hanh dong chi con la CAU: co dong tu
// "them / bo sung / mo rong / len ke hoach..." khong bi phu dinh, khong phai cau hoi, khong bao xoa / thay the du lieu cu.

const PATCH_VERBS: readonly Phrase[] = [
  ...CREATE_VERBS,
  ['len', 'ke', 'hoach'],
  ['len', 'danh', 'sach'],
  ['mo', 'rong'],
  ['viet', 'them'],
  ['goi', 'y'],
  ['de', 'xuat'],
  ['soan'],
  ['generate'],
  ['expand'],
  ['extend'],
];

/** Dong tu muon XOA / THAY THE / LUU TRU du lieu co san. Chi tinh khi theo sau (toi da 3 tu) la mot danh tu cua bang. */
const DESTRUCTIVE_VERBS: readonly Phrase[] = [
  ['xoa'],
  ['loai', 'bo'],
  ['go', 'bo'],
  ['don', 'sach'],
  ['don', 'dep'],
  ['bo', 'het'],
  ['delete'],
  ['remove'],
  ['clear'],
  ['wipe'],
  ['reset'],
  ['ghi', 'de'],
  ['thay', 'the'],
  ['luu', 'tru'],
  ['archive'],
  ['lam', 'lai', 'tu', 'dau'],
  ['tao', 'lai'],
  ['viet', 'lai'],
  ['sinh', 'lai'],
];
const BOARD_ENTITY_WORDS: ReadonlySet<string> = new Set(['the', 'card', 'cards', 'task', 'tasks', 'cot', 'list', 'lists', 'column', 'columns', 'bang', 'board', 'boards', 'viec', 'cu', 'het', 'tat', 'all', 'everything', 'toan', 'moi', 'cac', 'nhung']);
const DESTRUCTIVE_SPAN = 3;
const NEW_BOARD_SPAN = 2;
const BOARD_PARTS: readonly Phrase[] = [['cot'], ['the'], ['task'], ['viec'], ['list'], ['card'], ['danh', 'sach'], ['column']];

/** Cau co dong tu "them / bo sung / mo rong..." cho viec mo rong bang khong (chua xet phu dinh o ngoai, xem `negated`). */
export function licenceForPatch(words: readonly string[]): Licence {
  const at = indexesOfAny(words, PATCH_VERBS);
  if (at.length === 0) return { licensed: false, negated: false };
  return { licensed: true, negated: at.every((i) => negatedAt(words, i)) };
}

/** Cau yeu cau XOA / thay the du lieu cu cua bang ("xoa het the cu roi tao lai"). "Dung xoa gi ca" (bi phu dinh) khong tinh. */
export function asksDestructive(words: readonly string[]): boolean {
  for (const verb of DESTRUCTIVE_VERBS) {
    for (const start of phraseIndexes(words, verb)) {
      if (negatedAt(words, start)) continue;
      const end = start + verb.length;
      if (words.slice(end, end + DESTRUCTIVE_SPAN).some((w) => BOARD_ENTITY_WORDS.has(w))) return true;
    }
  }
  return false;
}

/** "Tao bang moi cho du an X": tao CA BANG (viec cua module AI sinh bang), khong phai mo rong bang dang mo. */
export function asksNewBoard(words: readonly string[]): boolean {
  if (hasAny(words, BOARD_PARTS)) return false;
  const boards = indexesOfAny(words, [['bang'], ['board']]);
  return indexesOfAny(words, CREATE_VERBS).some((v) => boards.some((b) => b > v && b - v <= NEW_BOARD_SPAN));
}
