// Buoc 5 - kiem tra bo trong so cua nhom (assign.weights.ts). HAM THUAN, khong can DB.
import { describe, expect, it } from 'vitest';
import { DEFAULT_WEIGHTS } from '../src/modules/assign/assign.score';
import {
  WEIGHT_KEYS,
  WEIGHT_MAX,
  WEIGHT_MIN,
  WEIGHT_SUM_TOLERANCE,
  isDefaultWeights,
  sameWeights,
  weightIssues,
} from '../src/modules/assign/assign.weights';
import { Rng } from '../src/scripts/simGenerator';

const W = (experience: unknown, reliability: unknown, availability: unknown) => ({ experience, reliability, availability });
const paths = (w: ReturnType<typeof W>) => weightIssues(w).map((i) => i.path);

describe('weightIssues - gia tri hop le', () => {
  it('bo mac dinh, cac bien [0,05; 0,70] va sai so cua tong deu duoc chap nhan', () => {
    expect(weightIssues(DEFAULT_WEIGHTS)).toEqual([]);
    expect(weightIssues(W(0.05, 0.25, 0.7))).toEqual([]);
    expect(weightIssues(W(0.7, 0.25, 0.05))).toEqual([]);
    expect(weightIssues(W(0.25, 0.7, 0.05))).toEqual([]);
    expect(weightIssues(W(1 / 3, 1 / 3, 1 / 3))).toEqual([]);
    // Tong lech nho hon sai so van qua (so thuc), lech hon thi khong
    expect(weightIssues(W(0.45 + WEIGHT_SUM_TOLERANCE / 2, 0.3, 0.25))).toEqual([]);
    expect(weightIssues(W(0.45 - WEIGHT_SUM_TOLERANCE / 2, 0.3, 0.25))).toEqual([]);
  });

  it('cac hang so dung gia tri thiet ke (§8: [0,05; 0,70]; tong = 1 voi sai so 1e-6)', () => {
    expect(WEIGHT_MIN).toBe(0.05);
    expect(WEIGHT_MAX).toBe(0.7);
    expect(WEIGHT_SUM_TOLERANCE).toBe(1e-6);
    expect([...WEIGHT_KEYS]).toEqual(['experience', 'reliability', 'availability']);
  });
});

describe('weightIssues - tung loai loi', () => {
  it('duoi 0,05 / tren 0,70: bao dung truong sai, khong bao tong khi tong van bang 1', () => {
    expect(paths(W(0.04, 0.5, 0.46))).toEqual(['experience']);
    expect(paths(W(0.5, 0.04, 0.46))).toEqual(['reliability']);
    expect(paths(W(0.5, 0.46, 0.04))).toEqual(['availability']);
    expect(paths(W(0.71, 0.2, 0.09))).toEqual(['experience']);
    expect(paths(W(0.2, 0.71, 0.09))).toEqual(['reliability']);
    expect(paths(W(0.2, 0.09, 0.71))).toEqual(['availability']);
    // Cham sat bien nhung con nam ngoai
    expect(paths(W(0.7000001, 0.2, 0.0999999))).toEqual(['experience']);
    expect(paths(W(0.0499999, 0.5, 0.4500001))).toEqual(['experience']);
    // So am
    expect(paths(W(-0.1, 0.6, 0.5))).toEqual(['experience']);
  });

  it('tong khac 1: chi bao "sum" khi ca ba deu trong khoang', () => {
    expect(paths(W(0.3, 0.3, 0.3))).toEqual(['sum']);
    expect(paths(W(0.4, 0.4, 0.4))).toEqual(['sum']);
    expect(paths(W(0.45 + 2 * WEIGHT_SUM_TOLERANCE, 0.3, 0.25))).toEqual(['sum']);
    expect(paths(W(0.45 - 2 * WEIGHT_SUM_TOLERANCE, 0.3, 0.25))).toEqual(['sum']);
    const [issue] = weightIssues(W(0.3, 0.3, 0.3));
    expect(issue!.message).toContain('0.9');
  });

  it('khong phai so huu han (NaN, Infinity, chuoi, null, thieu): bao dung truong do, khong nem loi, khong bao tong', () => {
    const bad: unknown[] = [Number.NaN, Infinity, -Infinity, '0.5', null, undefined, {}, [], true];
    for (const v of bad) {
      expect(paths(W(v, 0.3, 0.25)), String(v)).toEqual(['experience']);
      expect(paths(W(0.45, v, 0.25)), String(v)).toEqual(['reliability']);
      expect(paths(W(0.45, 0.3, v)), String(v)).toEqual(['availability']);
    }
    // Ca ba hong -> ba loi, van khong nem
    expect(paths(W(undefined, null, 'x'))).toEqual(['experience', 'reliability', 'availability']);
    // Thieu han khoa
    expect(paths({} as ReturnType<typeof W>)).toEqual(['experience', 'reliability', 'availability']);
  });

  it('nhieu loi cung luc duoc bao het mot lan (giao dien hien duoc tat ca)', () => {
    // 0,9 vuot tran, -0,1 duoi san, tong = 1,0 -> khong co loi tong
    expect(paths(W(0.9, -0.1, 0.2))).toEqual(['experience', 'reliability']);
    // Vua sai khoang vua sai tong
    expect(paths(W(0.9, 0.9, 0.9))).toEqual(['experience', 'reliability', 'availability', 'sum']);
  });

  it('thong bao noi ten thanh phan bang tieng Viet va nhac khoang cho phep', () => {
    const msg = (w: ReturnType<typeof W>) => weightIssues(w).map((i) => i.message).join(' | ');
    expect(msg(W(0.04, 0.5, 0.46))).toContain('kinh nghiem');
    expect(msg(W(0.5, 0.04, 0.46))).toContain('do tin cay');
    expect(msg(W(0.5, 0.46, 0.04))).toContain('kha dung');
    expect(msg(W(0.04, 0.5, 0.46))).toContain('0.05');
    expect(msg(W(0.04, 0.5, 0.46))).toContain('0.7');
    expect(msg(W(Number.NaN, 0.3, 0.25))).toContain('huu han');
  });
});

describe('weightIssues - doi chieu voi dinh nghia viet lai doc lap (500 bo ngau nhien, hat giong co dinh)', () => {
  it('rong <=> ca ba trong [0,05; 0,70] va |tong - 1| <= 1e-6; tap truong sai khop', () => {
    const rng = new Rng(20260920);
    const pick = () => {
      const r = rng.next();
      if (r < 0.15) return rng.pick([0.05, 0.7, 0.04999, 0.70001, 0, 1, -0.2, 0.25, 0.3]);
      return rng.range(-0.1, 1.0);
    };
    let valid = 0;
    for (let i = 0; i < 500; i += 1) {
      const a = pick();
      const b = pick();
      const c = i % 3 === 0 ? 1 - a - b : pick(); // 1/3 so bo co tong = 1 de nhanh "hop le" duoc kiem tra that su
      const w = W(a, b, c);
      const got = weightIssues(w).map((x) => x.path);

      const want: string[] = [];
      [a, b, c].forEach((v, idx) => {
        if (v < 0.05 || v > 0.7) want.push(WEIGHT_KEYS[idx]!);
      });
      if (Math.abs(a + b + c - 1) > 1e-6) want.push('sum');
      expect(got, JSON.stringify(w)).toEqual(want);
      if (want.length === 0) valid += 1;
    }
    // Phep thu phai co ca hai nhanh (khong bien thanh "toan bo deu sai")
    expect(valid).toBeGreaterThan(20);
    expect(valid).toBeLessThan(400);
  });
});

describe('sameWeights / isDefaultWeights', () => {
  const base = { experience: 0.45, reliability: 0.3, availability: 0.25 };
  it('bang nhau trong sai so 1e-9, khac neu lech hon; xet tung thanh phan; doi xung', () => {
    expect(sameWeights(base, { ...base })).toBe(true);
    expect(sameWeights(base, { ...base, experience: base.experience + 5e-10 })).toBe(true);
    expect(sameWeights({ ...base, experience: base.experience + 5e-10 }, base)).toBe(true);
    for (const k of WEIGHT_KEYS) {
      expect(sameWeights(base, { ...base, [k]: base[k] + 1e-8 }), k).toBe(false);
      expect(sameWeights({ ...base, [k]: base[k] - 1e-8 }, base), k).toBe(false);
    }
  });

  it('isDefaultWeights: dung 0,45 / 0,30 / 0,25; lech mot thanh phan la khong con mac dinh', () => {
    expect(isDefaultWeights(DEFAULT_WEIGHTS)).toBe(true);
    expect(isDefaultWeights({ experience: 0.45, reliability: 0.3, availability: 0.25 })).toBe(true);
    expect(isDefaultWeights({ experience: 0.5, reliability: 0.3, availability: 0.2 })).toBe(false);
    expect(isDefaultWeights({ experience: 0.45, reliability: 0.25, availability: 0.3 })).toBe(false);
    expect(isDefaultWeights({ experience: 0.4, reliability: 0.35, availability: 0.25 })).toBe(false);
  });
});
