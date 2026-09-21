// Buoc 6a - hoc trong so (assign.learn.ts). HAM THUAN, khong can DB.
// Bon loai bao dam:
//  (1) phep CHIEU: luon hop le (tong = 1, moi so trong [0,05; 0,70]) VA la diem hop le GAN NHAT (doi chieu vet can);
//  (2) mot buoc hoc di dung huong, dung do lon, khong bao gio pha bat bien;
//  (3) quyet dinh "co hoc khong" - tung ly do khong hoc va THU TU kiem tra;
//  (4) mot "truong nhom gia" co thien lech co dinh: trong so hoc duoc phai BAM THEO (so do truoc khi viet expect).
import { describe, expect, it } from 'vitest';
import {
  LEARN_ETA,
  LEARN_MIN_FEEDBACK,
  learnStep,
  learningDecision,
  parseRunCandidates,
  projectWeights,
  type Features,
  type LearnCandidate,
  type LearnInput,
} from '../src/modules/assign/assign.learn';
import { DEFAULT_WEIGHTS, type Weights } from '../src/modules/assign/assign.score';
import { WEIGHT_KEYS, WEIGHT_MAX, WEIGHT_MIN, weightIssues } from '../src/modules/assign/assign.weights';
import { Rng } from '../src/scripts/simGenerator';

const W = (experience: number, reliability: number, availability: number): Weights => ({ experience, reliability, availability });
const sum = (w: Weights) => w.experience + w.reliability + w.availability;
const near = (a: Weights, b: Weights, eps = 1e-12) => WEIGHT_KEYS.every((k) => Math.abs(a[k] - b[k]) <= eps);

describe('hang so hoc', () => {
  it('eta 0,05 (§5.8) va chi hoc tu phan hoi thu 10 (§8 chot chan 1)', () => {
    expect(LEARN_ETA).toBe(0.05);
    expect(LEARN_MIN_FEEDBACK).toBe(10);
  });
});

describe('projectWeights - phep chieu len {tong = 1, moi so trong [0,05; 0,70]}', () => {
  it('cac ca biet truoc (tinh tay)', () => {
    const cases: [string, Weights, Weights][] = [
      ['da hop le thi giu nguyen', W(0.45, 0.3, 0.25), W(0.45, 0.3, 0.25)],
      ['tran o mot so: (0,75; 0,30; 0) -> (0,70; 0,25; 0,05)', W(0.75, 0.3, 0), W(0.7, 0.25, 0.05)],
      ['tong 0,8, mot so o tran: (0,70; 0,05; 0,05) -> (0,70; 0,15; 0,15)', W(0.7, 0.05, 0.05), W(0.7, 0.15, 0.15)],
      ['tong dung 1 nhung vuot tran: (0,05; 0,05; 0,90) -> (0,15; 0,15; 0,70)', W(0.05, 0.05, 0.9), W(0.15, 0.15, 0.7)],
      ['ba so bang nhau lon: (2; 2; 2) -> moi so 1/3', W(2, 2, 2), W(1 / 3, 1 / 3, 1 / 3)],
      ['ba so bang nhau am: (-1; -1; -1) -> moi so 1/3', W(-1, -1, -1), W(1 / 3, 1 / 3, 1 / 3)],
      ['mot so rat lon: (5; 0; 0) -> (0,70; 0,15; 0,15)', W(5, 0, 0), W(0.7, 0.15, 0.15)],
    ];
    for (const [label, input, want] of cases) {
      const got = projectWeights(input);
      expect(near(got, want), `${label}: ${JSON.stringify(got)}`).toBe(true);
    }
  });

  it('TAI SAO khong "kep roi chuan hoa": cach do lam vo bat bien §14, phep chieu thi khong', () => {
    const v = W(0.7, 0.05, 0.05);
    const clamp = (x: number) => Math.min(WEIGHT_MAX, Math.max(WEIGHT_MIN, x));
    const clamped = { experience: clamp(v.experience), reliability: clamp(v.reliability), availability: clamp(v.availability) };
    const total = sum(clamped);
    const naive = W(clamped.experience / total, clamped.reliability / total, clamped.availability / total);
    expect(naive.experience).toBeGreaterThan(WEIGHT_MAX); // 0,875: vuot tran
    expect(weightIssues(naive).length).toBeGreaterThan(0);
    const good = projectWeights(v);
    expect(weightIssues(good)).toEqual([]);
    expect(good.experience).toBeLessThanOrEqual(WEIGHT_MAX + 1e-12);
  });

  it('LUON hop le tren 3000 dau vao ngau nhien rong [-2; 3] (hat giong co dinh): moi so trong khoang, tong = 1 sai so 1e-12', () => {
    const rng = new Rng(20260920);
    for (let i = 0; i < 3000; i += 1) {
      const v = W(rng.range(-2, 3), rng.range(-2, 3), rng.range(-2, 3));
      const p = projectWeights(v);
      for (const k of WEIGHT_KEYS) {
        expect(p[k], `${JSON.stringify(v)}`).toBeGreaterThanOrEqual(WEIGHT_MIN - 1e-12);
        expect(p[k], `${JSON.stringify(v)}`).toBeLessThanOrEqual(WEIGHT_MAX + 1e-12);
      }
      expect(Math.abs(sum(p) - 1), JSON.stringify(v)).toBeLessThan(1e-12);
      expect(weightIssues(p)).toEqual([]);
    }
  });

  it('la diem hop le GAN NHAT (doi chieu vet can luoi buoc 0,005 tren 300 dau vao) - khong chi la "mot diem hop le"', () => {
    const grid: Weights[] = [];
    for (let a = 0.05; a <= 0.7 + 1e-9; a += 0.005) {
      for (let b = 0.05; b <= 0.7 + 1e-9; b += 0.005) {
        const c = 1 - a - b;
        if (c >= WEIGHT_MIN - 1e-9 && c <= WEIGHT_MAX + 1e-9) grid.push(W(a, b, c));
      }
    }
    expect(grid.length).toBeGreaterThan(5000);
    const dist2 = (p: Weights, q: Weights) => WEIGHT_KEYS.reduce((s, k) => s + (p[k] - q[k]) ** 2, 0);
    const rng = new Rng(7);
    for (let i = 0; i < 300; i += 1) {
      const v = W(rng.range(-0.5, 1.5), rng.range(-0.5, 1.5), rng.range(-0.5, 1.5));
      const p = projectWeights(v);
      const best = Math.min(...grid.map((g) => dist2(v, g)));
      expect(dist2(v, p), JSON.stringify(v)).toBeLessThanOrEqual(best + 1e-9);
    }
  });

  it('luy dang (chieu hai lan = mot lan) va bat bien theo hoan vi ba thanh phan', () => {
    const rng = new Rng(11);
    const perms: [WeightKeyIdx, WeightKeyIdx, WeightKeyIdx][] = [
      [0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0],
    ];
    for (let i = 0; i < 300; i += 1) {
      const xs = [rng.range(-1, 2), rng.range(-1, 2), rng.range(-1, 2)] as [number, number, number];
      const p = projectWeights(W(...xs));
      expect(near(projectWeights(p), p), `luy dang ${xs}`).toBe(true);
      const base = [p.experience, p.reliability, p.availability];
      for (const perm of perms) {
        const q = projectWeights(W(xs[perm[0]], xs[perm[1]], xs[perm[2]]));
        const got = [q.experience, q.reliability, q.availability];
        expect(got.map((g, j) => Math.abs(g - base[perm[j]]!)).every((d) => d < 1e-12), `hoan vi ${perm} cua ${xs}`).toBe(true);
      }
    }
  });

  it('dau vao khong huu han bi tu choi bang RangeError (khong tra so rac)', () => {
    for (const bad of [Number.NaN, Infinity, -Infinity]) {
      expect(() => projectWeights(W(bad, 0.3, 0.7))).toThrow(RangeError);
      expect(() => projectWeights(W(0.3, bad, 0.7))).toThrow(RangeError);
      expect(() => projectWeights(W(0.3, 0.7, bad))).toThrow(RangeError);
    }
    expect(() => projectWeights({ experience: 0.3, reliability: 0.7 } as unknown as Weights)).toThrow(RangeError);
  });
});
type WeightKeyIdx = 0 | 1 | 2;

describe('learnStep - mot buoc cap nhat', () => {
  const TOP: Features = { experience: 1, reliability: 0.5, availability: 0 };
  const CHOSEN: Features = { experience: 0, reliability: 0.5, availability: 1 };

  it('do lon dung: w + eta * (x_chon - x_dau); (0,45; 0,30; 0,25) voi hieu (-1; 0; +1) -> (0,40; 0,30; 0,30)', () => {
    expect(near(learnStep(DEFAULT_WEIGHTS, TOP, CHOSEN), W(0.4, 0.3, 0.3))).toBe(true);
    // Doi vai tro (chon lai la nguoi hon o kinh nghiem) -> di nguoc lai
    expect(near(learnStep(DEFAULT_WEIGHTS, CHOSEN, TOP), W(0.5, 0.3, 0.2))).toBe(true);
    // eta tuy chinh: buoc gap doi
    expect(near(learnStep(DEFAULT_WEIGHTS, TOP, CHOSEN, 0.1), W(0.35, 0.3, 0.35))).toBe(true);
  });

  it('dung HUONG: thanh phan nguoi duoc chon hon thi tang, kem hon thi giam, bang nhau thi giu', () => {
    const w = W(1 / 3, 1 / 3, 1 / 3);
    const next = learnStep(w, { experience: 0.8, reliability: 0.5, availability: 0.2 }, { experience: 0.2, reliability: 0.5, availability: 0.8 });
    expect(next.experience).toBeLessThan(w.experience);
    expect(next.availability).toBeGreaterThan(w.availability);
    expect(next.reliability).toBeCloseTo(w.reliability, 12);
    expect(near(next, W(1 / 3 - 0.03, 1 / 3, 1 / 3 + 0.03))).toBe(true);
  });

  it('hai nguoi giong het nhau -> khong doi; nguoi duoc chon hon o CA BA thanh phan -> phep chieu tru deu, ket qua van la w', () => {
    expect(near(learnStep(DEFAULT_WEIGHTS, TOP, TOP), DEFAULT_WEIGHTS)).toBe(true);
    const zero: Features = { experience: 0, reliability: 0, availability: 0 };
    const one: Features = { experience: 1, reliability: 1, availability: 1 };
    expect(near(learnStep(DEFAULT_WEIGHTS, zero, one), DEFAULT_WEIGHTS)).toBe(true);
  });

  it('cham tran / san thi phep chieu giu bat bien: (0,70; 0,25; 0,05) + eta * (+1; +1; -1) -> (0,70; 0,25; 0,05)', () => {
    const out = learnStep(W(0.7, 0.25, 0.05), { experience: 0, reliability: 0, availability: 1 }, { experience: 1, reliability: 1, availability: 0 });
    expect(near(out, W(0.7, 0.25, 0.05))).toBe(true);
  });

  it('eta va dac trung khong hop le bi tu choi', () => {
    for (const eta of [0, -0.05, Number.NaN, Infinity]) {
      expect(() => learnStep(DEFAULT_WEIGHTS, TOP, CHOSEN, eta), String(eta)).toThrow(RangeError);
    }
    // Kem THONG DIEP cua chinh learnStep (khong phai cua projectWeights phia sau): phat hien dung cho, dung ten thanh phan
    expect(() => learnStep(DEFAULT_WEIGHTS, { ...TOP, experience: Number.NaN }, CHOSEN)).toThrow(/experience khong hop le/);
    expect(() => learnStep(DEFAULT_WEIGHTS, TOP, { ...CHOSEN, availability: Infinity })).toThrow(/availability khong hop le/);
    expect(() => learnStep(W(Number.NaN, 0.5, 0.5), TOP, CHOSEN)).toThrow(/experience khong hop le/);
  });

  it('LUON tra bo trong so hop le tren 2000 tinh huong ngau nhien (w hop le bat ky, dac trung [0,1])', () => {
    const rng = new Rng(99);
    const feat = (): Features => ({ experience: rng.next(), reliability: rng.next(), availability: rng.next() });
    for (let i = 0; i < 2000; i += 1) {
      const w = projectWeights(W(rng.range(-1, 2), rng.range(-1, 2), rng.range(-1, 2)));
      const out = learnStep(w, feat(), feat(), rng.chance(0.3) ? rng.range(0.01, 0.5) : LEARN_ETA);
      expect(weightIssues(out), JSON.stringify({ w, out })).toEqual([]);
    }
  });
});

describe('learningDecision - co hoc khong, vi sao khong', () => {
  const cand = (userId: string, score: number | null, features: Features | null): LearnCandidate => ({ userId, score, features });
  const A = cand('a', 60, { experience: 1, reliability: 0.5, availability: 0 });
  const B = cand('b', 40, { experience: 0, reliability: 0.5, availability: 1 });
  const C = cand('c', 10, null);
  const base = (over: Partial<LearnInput> = {}): LearnInput => ({
    weights: DEFAULT_WEIGHTS,
    feedbackCount: 10,
    topUserId: 'a',
    chosenUserId: 'b',
    candidates: [A, B, C],
    ...over,
  });

  it('du dieu kien -> LEARNED, kem trong so moi = learnStep', () => {
    const d = learningDecision(base());
    expect(d.learn).toBe(true);
    if (!d.learn) throw new Error('khong hoc');
    expect(d.reason).toBe('LEARNED');
    expect(near(d.next, learnStep(DEFAULT_WEIGHTS, A.features!, B.features!))).toBe(true);
    expect(near(d.next, W(0.4, 0.3, 0.3))).toBe(true);
  });

  it('tung ly do khong hoc', () => {
    const reason = (over: Partial<LearnInput>) => {
      const d = learningDecision(base(over));
      expect(d.learn, JSON.stringify(over)).toBe(false);
      return d.reason;
    };
    expect(reason({ topUserId: null })).toBe('NO_TOP');
    expect(reason({ chosenUserId: 'a' })).toBe('ACCEPTED');
    expect(reason({ feedbackCount: 9 })).toBe('TOO_EARLY');
    expect(reason({ chosenUserId: 'khong-co' })).toBe('NOT_CANDIDATE');
    expect(reason({ topUserId: 'khong-co' })).toBe('NOT_CANDIDATE');
    expect(reason({ chosenUserId: 'c' })).toBe('MISSING_COMPONENT'); // C thieu thanh phan
    expect(reason({ candidates: [cand('a', 60, null), B] })).toBe('MISSING_COMPONENT'); // nguoi xep dau thieu
    expect(reason({ candidates: [cand('a', null, A.features), B] })).toBe('MISSING_COMPONENT');
    expect(reason({ candidates: [A, cand('b', null, B.features)] })).toBe('MISSING_COMPONENT');
    expect(reason({ candidates: [A, cand('b', 60, B.features)] })).toBe('TIE'); // diem bang nhau (hon nho tie-break)
    expect(reason({ candidates: [cand('a', 30, A.features), B] })).toBe('TIE'); // nhat ky ky la: nguoi xep dau diem THAP hon
    expect(reason({ candidates: [A, cand('b', 40, A.features)] })).toBe('NO_CHANGE'); // hai nguoi giong het nhau
  });

  it('bien so luot: 9 -> TOO_EARLY, 10 -> hoc (mac dinh); minFeedback tuy chinh; ACCEPTED thang TOO_EARLY', () => {
    expect(learningDecision(base({ feedbackCount: 9 })).reason).toBe('TOO_EARLY');
    expect(learningDecision(base({ feedbackCount: 10 })).reason).toBe('LEARNED');
    expect(learningDecision(base({ feedbackCount: 11 })).reason).toBe('LEARNED');
    expect(learningDecision(base({ feedbackCount: 2, minFeedback: 3 })).reason).toBe('TOO_EARLY');
    expect(learningDecision(base({ feedbackCount: 3, minFeedback: 3 })).reason).toBe('LEARNED');
    expect(learningDecision(base({ feedbackCount: 0, chosenUserId: 'a' })).reason).toBe('ACCEPTED');
    expect(learningDecision(base({ feedbackCount: 0, topUserId: null })).reason).toBe('NO_TOP');
  });

  it('THU TU kiem tra co dinh: TOO_EARLY truoc NOT_CANDIDATE truoc MISSING_COMPONENT truoc TIE', () => {
    expect(learningDecision(base({ feedbackCount: 1, chosenUserId: 'khong-co' })).reason).toBe('TOO_EARLY');
    expect(learningDecision(base({ chosenUserId: 'khong-co', candidates: [cand('a', 60, null)] })).reason).toBe('NOT_CANDIDATE');
    expect(learningDecision(base({ candidates: [cand('a', 50, null), cand('b', 50, B.features)] })).reason).toBe('MISSING_COMPONENT');
  });

  it('khong sua dau vao; eta tuy chinh duoc chuyen xuong', () => {
    const input = base();
    const frozen = { ...input, candidates: Object.freeze([...input.candidates]) as readonly LearnCandidate[] };
    const before = JSON.stringify(frozen);
    const d = learningDecision(frozen);
    expect(JSON.stringify(frozen)).toBe(before);
    expect(d.learn).toBe(true);
    const big = learningDecision({ ...input, eta: 0.1 });
    if (!big.learn) throw new Error('khong hoc');
    expect(near(big.next, W(0.35, 0.3, 0.35))).toBe(true);
  });
});

describe('parseRunCandidates - doc lai AssignRun.candidates', () => {
  const comp = (value: number | null, scaled: number | null) => ({ value, scaled, share: 0.3 });
  const good = (userId: string, score: number | null = 50) => ({
    userId,
    rank: 1,
    score,
    components: { experience: comp(0.7, 1), reliability: comp(1, 0.5), availability: comp(0.4, 0) },
    evidence: [],
  });

  it('lay diem va DAC TRUNG theo `scaled` (khong phai `value`), giu thu tu, bo qua khoa la', () => {
    const out = parseRunCandidates([good('a', 61.5), good('b')]);
    expect(out).toEqual([
      { userId: 'a', score: 61.5, features: { experience: 1, reliability: 0.5, availability: 0 } },
      { userId: 'b', score: 50, features: { experience: 1, reliability: 0.5, availability: 0 } },
    ]);
  });

  it('thieu MOT thanh phan that (value = null) hoac khong co scaled -> features = null; diem khong so -> null', () => {
    const missingValue = { ...good('a'), components: { ...good('a').components, reliability: comp(null, 0.5) } };
    const missingScaled = { ...good('b'), components: { ...good('b').components, availability: comp(0.4, null) } };
    const noComponent = { userId: 'c', score: 5 };
    const badScore = good('d', null);
    const out = parseRunCandidates([missingValue, missingScaled, noComponent, badScore]);
    expect(out.map((c) => [c.userId, c.features === null])).toEqual([['a', true], ['b', true], ['c', true], ['d', false]]);
    expect(out[3]!.score).toBeNull();
    expect(parseRunCandidates([{ ...good('e'), score: 'cao' }])[0]!.score).toBeNull();
    expect(parseRunCandidates([{ ...good('f'), score: Number.NaN }])[0]!.score).toBeNull();
  });

  it('dong hong bi bo, khong nem loi; khong phai mang -> rong', () => {
    for (const bad of [null, undefined, {}, 'x', 42]) expect(parseRunCandidates(bad)).toEqual([]);
    const out = parseRunCandidates([null, 'x', 7, [], { rank: 1 }, { userId: 42 }, good('ok')]);
    expect(out.map((c) => c.userId)).toEqual(['ok']);
  });
});

// ===================== Truong nhom gia co thien lech =====================
// Thu nghiem (chay ngoai kho ma truoc khi viet expect, hat giong co dinh): moi vong co 4 ung vien voi ba dac trung ngau nhien
// trong [0,1]; he thong xep theo w . x, "truong nhom" chon theo thien lech CO DINH b . x (+ nhieu). Khong nhieu: L1 giua trong
// so hoc duoc va thien lech 0,50 -> 0,03 / 0,90 -> 0,02 / 0,80 -> 0,03 (8/8 hat giong), dong y top-1 76-88% -> 98-99%, chi ~25 trong
// 300 vong thuc su cap nhat. Truong nhom nhieu (+-0,15): L1 -> 0,10-0,16, dong y 66-78% -> 76-78%.

interface SimResult {
  end: Weights;
  distStart: number;
  distEnd: number;
  agreeFirst: number;
  agreeLast: number;
  learned: number;
}

function simulate(seed: number, bias: Weights, rounds: number, noise: number): SimResult {
  const rng = new Rng(seed);
  let w: Weights = { ...DEFAULT_WEIGHTS };
  const l1 = (a: Weights, b: Weights) => WEIGHT_KEYS.reduce((s, k) => s + Math.abs(a[k] - b[k]), 0);
  const dot = (p: Weights, x: Features) => WEIGHT_KEYS.reduce((s, k) => s + p[k] * x[k], 0);
  let agreeFirst = 0;
  let agreeLast = 0;
  let learned = 0;
  for (let r = 0; r < rounds; r += 1) {
    const xs: Features[] = Array.from({ length: 4 }, () => ({ experience: rng.next(), reliability: rng.next(), availability: rng.next() }));
    const order = xs.map((_, i) => i).sort((a, b) => dot(w, xs[b]!) - dot(w, xs[a]!));
    const top = order[0]!;
    const leader = xs
      .map((x, i) => ({ i, s: dot(bias, x) + (noise ? rng.range(-noise, noise) : 0) }))
      .sort((a, b) => b.s - a.s)[0]!.i;
    if (r < 100 && leader === top) agreeFirst += 1;
    if (r >= rounds - 100 && leader === top) agreeLast += 1;
    const candidates: LearnCandidate[] = xs.map((x, i) => ({ userId: `u${i}`, score: dot(w, x) * 100, features: x }));
    const d = learningDecision({ weights: w, feedbackCount: r + 1, topUserId: `u${top}`, chosenUserId: `u${leader}`, candidates });
    if (d.learn) {
      w = d.next;
      learned += 1;
      expect(weightIssues(w), `vong ${r}`).toEqual([]); // moi buoc trung gian deu hop le
    }
  }
  return { end: w, distStart: l1(DEFAULT_WEIGHTS, bias), distEnd: l1(w, bias), agreeFirst, agreeLast, learned };
}

describe('truong nhom gia co thien lech co dinh: trong so hoc duoc BAM THEO', () => {
  const SEEDS = [1009, 2018, 3027, 4036, 5045, 6054, 7063, 8072];
  const BIASES: [string, Weights][] = [
    ['thien lech kinh nghiem', W(0.7, 0.15, 0.15)],
    ['thien lech kha dung', W(0.15, 0.15, 0.7)],
    ['thien lech tin cay', W(0.15, 0.7, 0.15)],
  ];

  it('nhat quan (khong nhieu): 8/8 hat giong, L1 cuoi < 0,1 va < 25% luc dau, dong y top-1 ~99% o 100 vong cuoi (so voi 66-88% ban dau)', () => {
    for (const [name, bias] of BIASES) {
      for (const seed of SEEDS) {
        const r = simulate(seed, bias, 300, 0);
        expect(r.distEnd, `${name} ${seed}`).toBeLessThan(0.1);
        expect(r.distEnd, `${name} ${seed}`).toBeLessThan(0.25 * r.distStart);
        expect(r.agreeLast, `${name} ${seed}`).toBeGreaterThanOrEqual(90);
        expect(r.agreeLast, `${name} ${seed}`).toBeGreaterThan(r.agreeFirst);
        expect(r.learned, `${name} ${seed}`).toBeGreaterThan(5); // co hoc that
        expect(r.learned, `${name} ${seed}`).toBeLessThan(120); // va khong "hoc" o moi vong
      }
    }
  });

  it('truong nhom khong nhat quan (nhieu +-0,15): van gan thien lech hon luc dau o >= 7/8 hat giong va giam >= mot nua khoang cach trung binh', () => {
    for (const [name, bias] of BIASES) {
      const rows = SEEDS.map((s) => simulate(s, bias, 300, 0.15));
      const closer = rows.filter((r) => r.distEnd < r.distStart).length;
      const meanStart = rows.reduce((a, r) => a + r.distStart, 0) / rows.length;
      const meanEnd = rows.reduce((a, r) => a + r.distEnd, 0) / rows.length;
      expect(closer, name).toBeGreaterThanOrEqual(7);
      expect(meanEnd, name).toBeLessThan(0.5 * meanStart);
    }
  });

  it('DOI CHUNG: truong nhom chon dung theo trong so mac dinh (khong nhieu) -> KHONG hoc gi, trong so giu nguyen', () => {
    for (const seed of SEEDS) {
      const r = simulate(seed, DEFAULT_WEIGHTS, 300, 0);
      expect(r.learned, String(seed)).toBe(0);
      expect(near(r.end, DEFAULT_WEIGHTS), String(seed)).toBe(true);
      expect(r.agreeFirst).toBe(100);
    }
  });
});
