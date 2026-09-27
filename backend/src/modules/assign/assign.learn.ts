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
// DIEM HOP LE GAN NHAT (tong dung, moi so trong khoang) nen luon dung bat bien; cung y do, chinh xac hon. Phep chieu nam o
// assign.weights.ts (projectOnto / projectWithin).
//
// BUOC 11 (§17.7): bo trong so co bon khoa nhung bo hoc CHI chinh ba thanh phan tu lich su, trong dung "khoi" cua chung
// (1 - trong so Ho so); trong so Ho so giu nguyen. Voi Ho so = 0 (bo trong so dang luu, LEGACY_WEIGHTS_V1) ket qua trung tung bit
// voi truoc buoc 11. Luat day du "hoc tren cac thanh phan ca hai nguoi deu co" la buoc 13.

import type { Weights } from './assign.score';
import { LEGACY_KEYS, projectWithin, sameWeights, type LegacyKey } from './assign.weights';

/** Toc do hoc (§5.8). */
export const LEARN_ETA = 0.05;
/** Chi bat dau HOC tu luot phan hoi thu nay tro di; truoc do chi ghi nhan (muc 1) - §8 chot chan 1. */
export const LEARN_MIN_FEEDBACK = 10;

/** Ba thanh phan tu lich su cua mot ung vien - cac thanh phan bo hoc chinh o buoc 11. */
export type Features = Readonly<Record<LegacyKey, number>>;

/**
 * Mot buoc cap nhat: keo trong so ve phia thanh phan nguoi duoc chon (`chosen`) hon nguoi xep dau (`top`), chi tren ba thanh phan tu
 * lich su, roi chieu ba so do len {tong = 1 - Ho so, moi so trong khoang}. Ho so khong doi.
 */
export function learnStep(w: Weights, top: Features, chosen: Features, eta: number = LEARN_ETA): Weights {
  if (!Number.isFinite(eta) || eta <= 0) throw new RangeError('eta phai la so huu han > 0');
  const raw: Weights = { ...w };
  for (const k of LEGACY_KEYS) {
    const d = chosen[k] - top[k];
    if (!Number.isFinite(w[k]) || !Number.isFinite(d)) throw new RangeError(`gia tri ${k} khong hop le`);
    raw[k] = w[k] + eta * d;
  }
  return projectWithin(raw, LEGACY_KEYS);
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
  const out = {} as Record<LegacyKey, number>;
  for (const k of LEGACY_KEYS) {
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
