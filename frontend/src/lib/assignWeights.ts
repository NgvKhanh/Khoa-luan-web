import type { AssignWeightKey, AssignWeights } from '../types/assign';

// Phep can bang ba thanh truot trong so (ASSIGN_MODULE.md §5.7, §8). Lam viec bang SO NGUYEN PHAN TRAM de tong luon
// dung 100 (khong lech do lam tron so thuc) va khop luat cua may chu: moi so trong [5%; 70%], tong 100%.

export const WEIGHT_MIN_PCT = 5;
export const WEIGHT_MAX_PCT = 70;
export const WEIGHT_KEYS: readonly AssignWeightKey[] = ['experience', 'reliability', 'availability'];

export type WeightsPct = Record<AssignWeightKey, number>;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Dua ve so nguyen trong [5; 70] va tong 100: chinh tung don vi tren thanh phan con cho (thu tu co dinh). */
function repair(values: number[]): number[] {
  const out = values.map((v) => clamp(Math.round(v), WEIGHT_MIN_PCT, WEIGHT_MAX_PCT));
  let diff = 100 - out.reduce((a, b) => a + b, 0);
  for (let guard = 0; diff !== 0 && guard < 300; guard += 1) {
    const step = diff > 0 ? 1 : -1;
    const idx = out.findIndex((v) => (step > 0 ? v < WEIGHT_MAX_PCT : v > WEIGHT_MIN_PCT));
    if (idx < 0) break;
    out[idx]! += step;
    diff -= step;
  }
  return out;
}

/**
 * Trong so cua may chu (so thuc, tong 1) -> phan tram nguyen, tong 100 (phuong phap phan du lon nhat, roi dam bao
 * khoang cho phep). Trong so nhom da HOC thuong le (0,3833...) nen phai lam tron o day.
 */
export function toPct(w: AssignWeights): WeightsPct {
  const raw = WEIGHT_KEYS.map((k) => w[k] * 100);
  const total = raw.reduce((a, b) => a + b, 0);
  const scaled = total > 0 ? raw.map((r) => (r * 100) / total) : [100 / 3, 100 / 3, 100 / 3];
  const floors = scaled.map((r) => Math.floor(r + 1e-9));
  let rest = 100 - floors.reduce((a, b) => a + b, 0);
  const order = scaled
    .map((r, i) => ({ i, frac: r - Math.floor(r + 1e-9) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let n = 0; rest > 0; n += 1, rest -= 1) floors[order[n % order.length]!.i]! += 1;
  const [experience, reliability, availability] = repair(floors) as [number, number, number];
  return { experience, reliability, availability };
}

/** Phan tram nguyen -> trong so gui len may chu (tong 1 sai so ~1e-16). */
export function fromPct(p: WeightsPct): AssignWeights {
  return {
    experience: p.experience / 100,
    reliability: p.reliability / 100,
    availability: p.availability / 100,
  };
}

export const pctSum = (p: WeightsPct) => p.experience + p.reliability + p.availability;

export const samePct = (a: WeightsPct, b: WeightsPct) => WEIGHT_KEYS.every((k) => a[k] === b[k]);

/**
 * Nguoi dung keo thanh `key` toi `value` (%): thanh do duoc kep vao [5; 70]; phan con lai (100 - value) chia cho hai
 * thanh kia THEO TI LE hien tai (hai thanh dang bang 0 thi chia deu) roi kep de ca hai van trong khoang. Tong luon 100.
 */
export function rebalance(current: WeightsPct, key: AssignWeightKey, value: number): WeightsPct {
  // Gia tri khong phai so (o nhap rong...) -> giu nguyen thanh nay, khong sinh NaN
  const v = clamp(Number.isFinite(value) ? Math.round(value) : current[key], WEIGHT_MIN_PCT, WEIGHT_MAX_PCT);
  const [i, j] = WEIGHT_KEYS.filter((k) => k !== key) as [AssignWeightKey, AssignWeightKey];
  const remainder = 100 - v; // trong [30; 95]
  const ci = current[i];
  const cj = current[j];
  const share = ci + cj > 0 ? Math.round((remainder * ci) / (ci + cj)) : Math.round(remainder / 2);
  // ri + rj = remainder va moi so trong [5; 70] -> ri trong [max(5, remainder - 70); min(70, remainder - 5)] (luon khong rong)
  const ri = clamp(share, Math.max(WEIGHT_MIN_PCT, remainder - WEIGHT_MAX_PCT), Math.min(WEIGHT_MAX_PCT, remainder - WEIGHT_MIN_PCT));
  return { ...current, [key]: v, [i]: ri, [j]: remainder - ri } as WeightsPct;
}
