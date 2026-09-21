import { describe, expect, it } from 'vitest';
import {
  WEIGHT_KEYS,
  WEIGHT_MAX_PCT,
  WEIGHT_MIN_PCT,
  fromPct,
  pctSum,
  rebalance,
  samePct,
  toPct,
  type WeightsPct,
} from './assignWeights';

const P = (experience: number, reliability: number, availability: number): WeightsPct => ({ experience, reliability, availability });

/** Mot bo phan tram hop le: tong 100, moi so trong [5; 70]. */
function valid(p: WeightsPct): boolean {
  return pctSum(p) === 100 && WEIGHT_KEYS.every((k) => Number.isInteger(p[k]) && p[k] >= WEIGHT_MIN_PCT && p[k] <= WEIGHT_MAX_PCT);
}

// Bo sinh so ngau nhien tat dinh (LCG) - khong dung Math.random de test lap lai duoc
function lcg(seed: number) {
  let s = seed >>> 0 || 1;
  const next = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  return { next, int: (lo: number, hi: number) => lo + Math.floor(next() * (hi - lo + 1)) };
}

const ALL_VALID: WeightsPct[] = [];
for (let a = WEIGHT_MIN_PCT; a <= WEIGHT_MAX_PCT; a += 1) {
  for (let b = WEIGHT_MIN_PCT; b <= WEIGHT_MAX_PCT; b += 1) {
    const c = 100 - a - b;
    if (c >= WEIGHT_MIN_PCT && c <= WEIGHT_MAX_PCT) ALL_VALID.push(P(a, b, c));
  }
}

describe('hang so', () => {
  it('khop luat cua may chu: moi thanh trong [5%; 70%], ba thanh cong lai 100%', () => {
    expect(WEIGHT_MIN_PCT).toBe(5);
    expect(WEIGHT_MAX_PCT).toBe(70);
    expect([...WEIGHT_KEYS]).toEqual(['experience', 'reliability', 'availability']);
    expect(ALL_VALID.length).toBeGreaterThan(1000);
  });
});

describe('toPct - trong so may chu (so thuc) -> phan tram nguyen, tong 100', () => {
  it('bo mac dinh 0,45 / 0,30 / 0,25 -> 45 / 30 / 25', () => {
    expect(toPct({ experience: 0.45, reliability: 0.3, availability: 0.25 })).toEqual(P(45, 30, 25));
  });

  it('trong so DA HOC thuong le: phuong phap phan du lon nhat (38,33 / 30,11 / 31,56 -> 38 / 30 / 32)', () => {
    expect(toPct({ experience: 0.38333, reliability: 0.30111, availability: 0.31556 })).toEqual(P(38, 30, 32));
  });

  it('cham bien: (0,70; 0,25; 0,05) va (0,70; 0,15; 0,15) giu nguyen; sai so 1e-12 khong lam roi xuong 4%', () => {
    expect(toPct({ experience: 0.7, reliability: 0.25, availability: 0.05 })).toEqual(P(70, 25, 5));
    expect(toPct({ experience: 0.7, reliability: 0.15, availability: 0.15 })).toEqual(P(70, 15, 15));
    expect(toPct({ experience: 0.7, reliability: 0.25, availability: 0.05 - 1e-12 })).toEqual(P(70, 25, 5));
  });

  it('dau vao bat thuong van cho bo hop le: tong khac 1 duoc quy ve 100; toan 0 / NaN chia deu (34 / 33 / 33)', () => {
    expect(toPct({ experience: 0.5, reliability: 0.5, availability: 0.5 })).toEqual(P(34, 33, 33));
    expect(toPct({ experience: 0, reliability: 0, availability: 0 })).toEqual(P(34, 33, 33));
    expect(toPct({ experience: Number.NaN, reliability: 0.3, availability: 0.3 })).toEqual(P(34, 33, 33));
    expect(valid(toPct({ experience: 3, reliability: 1, availability: 1 }))).toBe(true);
    expect(valid(toPct({ experience: 1, reliability: 0, availability: 0 }))).toBe(true);
  });

  it('VONG TRON chinh xac cho MOI bo hop le (moi so 5..70, tong 100): toPct(fromPct(p)) = p', () => {
    for (const p of ALL_VALID) expect(toPct(fromPct(p)), JSON.stringify(p)).toEqual(p);
  });

  it('luon ra bo hop le tren 3000 bo thuc ngau nhien nam trong khoang cua may chu', () => {
    const r = lcg(20260920);
    for (let i = 0; i < 3000; i += 1) {
      const base = ALL_VALID[r.int(0, ALL_VALID.length - 1)]!;
      // Nhieu nho quanh mot bo hop le (nhu ket qua hoc: le nhung van trong khoang, tong ~ 1)
      const w = {
        experience: base.experience / 100 + (r.next() - 0.5) * 0.004,
        reliability: base.reliability / 100 + (r.next() - 0.5) * 0.004,
        availability: base.availability / 100 + (r.next() - 0.5) * 0.004,
      };
      const p = toPct(w);
      expect(valid(p), JSON.stringify({ w, p })).toBe(true);
    }
  });
});

describe('rebalance - keo mot thanh, hai thanh con lai chia phan du', () => {
  const DEFAULT = P(45, 30, 25);

  it('cac ca tinh tay', () => {
    // 40 con lai chia theo ti le 30 : 25 -> 21,8 -> 22 va 18
    expect(rebalance(DEFAULT, 'experience', 60)).toEqual(P(60, 22, 18));
    // Keo xuong san: con lai 95 chia 30 : 25 -> 52 va 43
    expect(rebalance(DEFAULT, 'experience', 5)).toEqual(P(5, 52, 43));
    // Keo len tran: con lai 30 chia 30 : 25 -> 16 va 14
    expect(rebalance(DEFAULT, 'experience', 70)).toEqual(P(70, 16, 14));
    // Thanh o giua: kha dung 25 -> 40, con lai 60 chia 45 : 30 -> 36 va 24
    expect(rebalance(DEFAULT, 'availability', 40)).toEqual(P(36, 24, 40));
    // Thanh tin cay 30 -> 10: con lai 90 chia 45 : 25 -> 57,9 -> 58 va 32
    expect(rebalance(DEFAULT, 'reliability', 10)).toEqual(P(58, 10, 32));
  });

  it('gia tri keo bi kep va lam tron: 3 -> 5, 90 -> 70, 60,4 -> 60, 60,6 -> 61; khong phai so thi giu nguyen (khong sinh NaN)', () => {
    expect(rebalance(DEFAULT, 'experience', 3).experience).toBe(5);
    expect(rebalance(DEFAULT, 'experience', 90).experience).toBe(70);
    expect(rebalance(DEFAULT, 'experience', 60.4).experience).toBe(60);
    expect(rebalance(DEFAULT, 'experience', 60.6).experience).toBe(61);
    expect(rebalance(DEFAULT, 'experience', -50).experience).toBe(5);
    for (const bad of [Number.NaN, Infinity, -Infinity]) expect(rebalance(DEFAULT, 'experience', bad), String(bad)).toEqual(DEFAULT);
  });

  it('hai thanh con lai dang bang 0 -> chia deu; mot thanh bang 0 -> thanh kia nhan phan lon nhung van trong khoang', () => {
    expect(rebalance(P(100, 0, 0), 'experience', 50)).toEqual(P(50, 25, 25));
    const r = rebalance(P(60, 40, 0), 'experience', 50);
    expect(valid(r)).toBe(true);
    expect(r).toEqual(P(50, 45, 5));
  });

  it('KHONG lam thay doi neu keo ve dung gia tri hien tai (moi bo hop le, moi thanh)', () => {
    for (const p of ALL_VALID) {
      for (const k of WEIGHT_KEYS) expect(rebalance(p, k, p[k]), `${JSON.stringify(p)} ${k}`).toEqual(p);
    }
  });

  it('luon ra bo hop le, thanh dang keo dung bang gia tri (da kep), 5000 tinh huong ngau nhien (ke ca gia tri ngoai [5; 70])', () => {
    const r = lcg(7);
    for (let i = 0; i < 5000; i += 1) {
      const cur = ALL_VALID[r.int(0, ALL_VALID.length - 1)]!;
      const key = WEIGHT_KEYS[r.int(0, 2)]!;
      const value = r.int(-20, 120) + r.next();
      const out = rebalance(cur, key, value);
      expect(valid(out), JSON.stringify({ cur, key, value, out })).toBe(true);
      expect(out[key], JSON.stringify({ cur, key, value })).toBe(Math.min(70, Math.max(5, Math.round(value))));
    }
  });

  it('ti le hai thanh con lai duoc giu gan dung (lech toi da 1 diem % do lam tron) khi khong cham bien', () => {
    for (const cur of [P(45, 30, 25), P(40, 40, 20), P(20, 50, 30), P(30, 30, 40)]) {
      for (const key of WEIGHT_KEYS) {
        const out = rebalance(cur, key, cur[key] + 10);
        const [i, j] = WEIGHT_KEYS.filter((k) => k !== key);
        const remainder = 100 - out[key];
        const expectI = (remainder * cur[i!]) / (cur[i!] + cur[j!]);
        if (out[i!] > WEIGHT_MIN_PCT && out[i!] < WEIGHT_MAX_PCT) expect(Math.abs(out[i!] - expectI)).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('fromPct / pctSum / samePct', () => {
  it('fromPct chia 100; ba so cong lai 1 sai so 1e-12 (may chu chap nhan 1e-6)', () => {
    const w = fromPct(P(45, 30, 25));
    expect(w).toEqual({ experience: 0.45, reliability: 0.3, availability: 0.25 });
    for (const p of ALL_VALID.slice(0, 200)) {
      const f = fromPct(p);
      expect(Math.abs(f.experience + f.reliability + f.availability - 1)).toBeLessThan(1e-12);
    }
  });

  it('pctSum, samePct', () => {
    expect(pctSum(P(45, 30, 25))).toBe(100);
    expect(samePct(P(45, 30, 25), P(45, 30, 25))).toBe(true);
    for (const k of WEIGHT_KEYS) expect(samePct(P(45, 30, 25), { ...P(45, 30, 25), [k]: 46 } as WeightsPct)).toBe(false);
  });
});
