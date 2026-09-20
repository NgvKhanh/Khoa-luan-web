// Trong so ba thanh phan cua mot nhom: hang so + kiem tra (ASSIGN_MODULE.md §5.7, §8, §9).
// HAM THUAN: khong Prisma, khong doc dong ho. Dung o ba noi: zod (kiem tra body PUT), service (rao ve
// cuoi truoc khi ghi) va - o buoc 6 - bo hoc trong so (ket qua hoc cung phai qua cua nay).

import { DEFAULT_WEIGHTS, type Weights } from './assign.score';

/** Moi trong so nam trong [0,05; 0,70]: khong thanh phan nao bi tat han, cung khong thanh phan nao ap dao. */
export const WEIGHT_MIN = 0.05;
export const WEIGHT_MAX = 0.7;
/** Tong phai bang 1 voi sai so nay (so thuc: 0,1 + 0,2 + 0,7 khong dung tuyet doi 1). */
export const WEIGHT_SUM_TOLERANCE = 1e-6;

export const WEIGHT_KEYS = ['experience', 'reliability', 'availability'] as const;
export type WeightKey = (typeof WEIGHT_KEYS)[number];

/** Ten hien cho nguoi dung trong thong bao loi. */
const LABEL: Record<WeightKey, string> = {
  experience: 'kinh nghiem',
  reliability: 'do tin cay',
  availability: 'kha dung',
};

export interface WeightIssue {
  /** Truong sai, hoac 'sum' neu ca bo ba khong cong lai bang 1. */
  path: WeightKey | 'sum';
  message: string;
}

/**
 * Liet ke MOI loi cua mot bo trong so (rong = hop le). Nhan `unknown`-an toan: gia tri khong phai so huu han
 * (NaN, Infinity, chuoi, thieu) deu bi bao loi thay vi nem ngoai le, vi ham nay chay tren du lieu tu nguoi dung.
 */
export function weightIssues(w: Readonly<Record<WeightKey, unknown>>): WeightIssue[] {
  const issues: WeightIssue[] = [];
  let sum = 0;
  let finiteCount = 0;
  for (const key of WEIGHT_KEYS) {
    const v = w[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      issues.push({ path: key, message: `trong so ${LABEL[key]} phai la so huu han` });
      continue;
    }
    finiteCount += 1;
    sum += v;
    if (v < WEIGHT_MIN || v > WEIGHT_MAX) {
      issues.push({ path: key, message: `trong so ${LABEL[key]} phai nam trong [${WEIGHT_MIN}, ${WEIGHT_MAX}]` });
    }
  }
  // Tong chi co nghia khi ca ba deu la so
  if (finiteCount === WEIGHT_KEYS.length && Math.abs(sum - 1) > WEIGHT_SUM_TOLERANCE) {
    issues.push({ path: 'sum', message: `tong ba trong so phai bang 1 (hien la ${Number(sum.toFixed(6))})` });
  }
  return issues;
}

/** Hai bo trong so co nhu nhau khong (sai so 1e-9: khac nhau do lam tron khi luu Float khong tinh). */
export function sameWeights(a: Weights, b: Weights): boolean {
  return WEIGHT_KEYS.every((k) => Math.abs(a[k] - b[k]) <= 1e-9);
}

export function isDefaultWeights(w: Weights): boolean {
  return sameWeights(w, DEFAULT_WEIGHTS);
}
