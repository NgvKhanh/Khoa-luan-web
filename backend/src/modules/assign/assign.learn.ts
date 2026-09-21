// Hoc trong so cua nhom (muc 2) - ASSIGN_MODULE.md §8. HAM THUAN: khong Prisma, khong doc dong ho.
//
// Perceptron xep hang theo cap (cung ho voi RankNet), hoc truc tuyen tung luot phan hoi:
// module xep `a` dung dau nhung nguoi dung giao cho `b` -> keo trong so ve phia cac thanh phan `b` hon `a`:
//     w <- chieu( w + eta * (x_b - x_a) )
// `x` la ba gia tri DUNG DE CONG (`scaled`, da chuan hoa trong nhom o buoc 4b) - chinh la thu tao ra diem, nen
// buoc cap nhat di dung huong voi cai da xep sai. Gia tri tho (`value`) khong dung: no khong quyet dinh hang.
//
// CHIEU thay vi "kep roi chuan hoa" (§8 ghi ban dau): kep tung so vao [0,05; 0,70] roi chia cho tong CO THE lam
// vo chinh bat bien §14 - (0,70; 0,05; 0,05) chuan hoa thanh (0,875; 0,0625; 0,0625), vuot tran. Phep chieu tim
// DIEM HOP LE GAN NHAT (tong = 1, moi so trong khoang) nen luon dung bat bien; cung y do, chinh xac hon.

import type { Weights } from './assign.score';
import { WEIGHT_KEYS, WEIGHT_MAX, WEIGHT_MIN, sameWeights, type WeightKey } from './assign.weights';

/** Toc do hoc (§5.8). */
export const LEARN_ETA = 0.05;
/** Chi bat dau HOC tu luot phan hoi thu nay tro di; truoc do chi ghi nhan (muc 1) - §8 chot chan 1. */
export const LEARN_MIN_FEEDBACK = 10;

/** Ba thanh phan cua mot ung vien (cung khoa voi Weights). */
export type Features = Readonly<Record<WeightKey, number>>;

const BISECTION_STEPS = 200;

/**
 * Chieu vuong goc len tap {tong = 1, moi so trong [WEIGHT_MIN, WEIGHT_MAX]}: nghiem la
 * w_i = kep(v_i - tau) voi tau chon sao cho tong bang 1. Ham tong theo tau don dieu giam va lien tuc, di tu
 * 3 * MAX (= 2,1) xuong 3 * MIN (= 0,15) nen luon co nghiem; tim bang chia doi (tat dinh, khong phu thuoc thu tu).
 */
export function projectWeights(v: Weights): Weights {
  const xs = WEIGHT_KEYS.map((k) => v[k]);
  if (!xs.every((x) => typeof x === 'number' && Number.isFinite(x))) {
    throw new RangeError('trong so phai la so huu han');
  }
  const clamp = (x: number) => Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, x));
  const total = (tau: number) => xs.reduce((s, x) => s + clamp(x - tau), 0);

  let lo = Math.min(...xs) - WEIGHT_MAX; // tai day moi so bi kep len MAX: total = 3 * MAX >= 1
  let hi = Math.max(...xs) - WEIGHT_MIN; // tai day moi so bi kep xuong MIN: total = 3 * MIN <= 1
  for (let i = 0; i < BISECTION_STEPS; i += 1) {
    const mid = (lo + hi) / 2;
    if (total(mid) > 1) lo = mid;
    else hi = mid;
  }
  const tau = (lo + hi) / 2;
  const [experience, reliability, availability] = xs.map((x) => clamp(x - tau)) as [number, number, number];
  return { experience, reliability, availability };
}

/** Mot buoc cap nhat: keo trong so ve phia thanh phan nguoi duoc chon (`chosen`) hon nguoi xep dau (`top`). */
export function learnStep(w: Weights, top: Features, chosen: Features, eta: number = LEARN_ETA): Weights {
  if (!Number.isFinite(eta) || eta <= 0) throw new RangeError('eta phai la so huu han > 0');
  const raw = {} as Record<WeightKey, number>;
  for (const k of WEIGHT_KEYS) {
    const d = chosen[k] - top[k];
    if (!Number.isFinite(w[k]) || !Number.isFinite(d)) throw new RangeError(`gia tri ${k} khong hop le`);
    raw[k] = w[k] + eta * d;
  }
  return projectWeights(raw);
}

export interface LearnCandidate {
  userId: string;
  score: number | null;
  /** null = thieu it nhat mot trong ba thanh phan (chua co du lieu that) -> khong hoc tu so sanh nay (§8 chot chan 3). */
  features: Features | null;
}

export type LearnReason =
  | 'LEARNED'
  | 'NO_TOP'
  | 'ACCEPTED'
  | 'TOO_EARLY'
  | 'NOT_CANDIDATE'
  | 'MISSING_COMPONENT'
  | 'TIE'
  | 'NO_CHANGE';

export type LearnDecision =
  | { learn: true; reason: 'LEARNED'; next: Weights }
  | { learn: false; reason: Exclude<LearnReason, 'LEARNED'> };

export interface LearnInput {
  /** Trong so HIEN TAI cua nhom. */
  weights: Weights;
  /** So luot phan hoi cua nhom SAU KHI da cong luot nay. */
  feedbackCount: number;
  topUserId: string | null;
  chosenUserId: string;
  candidates: readonly LearnCandidate[];
  eta?: number;
  minFeedback?: number;
}

/**
 * Luot phan hoi nay co duoc dung de hoc khong, va neu co thi trong so moi la gi. Thu tu kiem tra (co dinh, dung de
 * bao "vi sao khong hoc"):
 *  NO_TOP -> ACCEPTED (giao dung nguoi xep dau: khong co loi de sua) -> TOO_EARLY (chua du luot) ->
 *  NOT_CANDIDATE (nguoi duoc chon khong nam trong danh sach da cham) -> MISSING_COMPONENT (mot trong hai thieu
 *  thanh phan) -> TIE (diem khong lon hon han: nguoi xep dau chi hon nho tie-break) -> NO_CHANGE (chieu xong
 *  van khong doi) -> LEARNED.
 */
export function learningDecision(input: LearnInput): LearnDecision {
  const { weights, feedbackCount, topUserId, chosenUserId, candidates } = input;
  const minFeedback = input.minFeedback ?? LEARN_MIN_FEEDBACK;
  if (topUserId === null) return { learn: false, reason: 'NO_TOP' };
  if (chosenUserId === topUserId) return { learn: false, reason: 'ACCEPTED' };
  if (feedbackCount < minFeedback) return { learn: false, reason: 'TOO_EARLY' };

  const top = candidates.find((c) => c.userId === topUserId);
  const chosen = candidates.find((c) => c.userId === chosenUserId);
  if (!top || !chosen) return { learn: false, reason: 'NOT_CANDIDATE' };
  if (!top.features || !chosen.features || top.score === null || chosen.score === null) {
    return { learn: false, reason: 'MISSING_COMPONENT' };
  }
  if (!(top.score > chosen.score)) return { learn: false, reason: 'TIE' };

  const next = learnStep(weights, top.features, chosen.features, input.eta);
  if (sameWeights(next, weights)) return { learn: false, reason: 'NO_CHANGE' };
  return { learn: true, reason: 'LEARNED', next };
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

function featuresOf(components: unknown): Features | null {
  if (typeof components !== 'object' || components === null) return null;
  const record = components as Record<string, unknown>;
  const out = {} as Record<WeightKey, number>;
  for (const k of WEIGHT_KEYS) {
    const c = record[k];
    if (typeof c !== 'object' || c === null) return null;
    const { value, scaled } = c as Record<string, unknown>;
    // Du ca hai: co gia tri that (value) VA gia tri dung de cong (scaled)
    if (!isNum(value) || !isNum(scaled)) return null;
    out[k] = scaled;
  }
  return out;
}

/**
 * Doc lai danh sach ung vien da luu trong AssignRun.candidates (JSON). Dong hong bi bo, khong nem loi: mot luot
 * nhat ky hong chi mat co hoi hoc cua rieng no.
 */
export function parseRunCandidates(json: unknown): LearnCandidate[] {
  if (!Array.isArray(json)) return [];
  const out: LearnCandidate[] = [];
  for (const raw of json) {
    if (typeof raw !== 'object' || raw === null) continue;
    const c = raw as Record<string, unknown>;
    if (typeof c.userId !== 'string') continue;
    out.push({ userId: c.userId, score: isNum(c.score) ? c.score : null, features: featuresOf(c.components) });
  }
  return out;
}
