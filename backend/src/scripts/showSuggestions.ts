// Xem bo cham cap (assign.score.ts) chay tren du lieu mo phong. CHAY TAY, khong ghi CSDL:
//
//   npm run assign:suggest                      hat giong mac dinh
//   npm run assign:suggest -- --seed=7 --show=6
//
// In (1) top-3 ung vien kem bang chung cho cac the DANG MO hom nay, canh ky nang AN de mat thuong
// doi chieu; (2) PHAT LAI lich su: voi moi the, chi dung thong tin biet duoc luc no duoc giao, xem
// nguoi xep dau co phai "dap an tot nhat" khong.
//
// LUU Y PHUONG PHAP: (2) chi la KIEM TRA NHANH xem bo cham co vo nghia khong (so voi ngau nhien va so
// voi phan cong that trong lich su) - KHONG phai danh gia: chua co nhanh nen, chua quet tham so,
// chua co khoang tin cay (do la viec cua buoc 7). Script DOC ky nang an de danh gia; module assign/
// thi khong bao gio duoc thay chung.

import { DEFAULT_WEIGHTS, rankCandidates, type RankedCandidate, type Weights } from '../modules/assign/assign.score';
import { DEFAULT_SIM, availableAt, generateSimulation, skillAt } from './simGenerator';
import { componentSpread, replay, snapshotAsOf } from './simReplay';
import { simDayToDate, vnToday } from './simSeed';
import { TOPICS } from './simVocab';

function parseArgs(argv: string[]) {
  let seed = DEFAULT_SIM.seed;
  let show = 12;
  for (const arg of argv) {
    if (arg.startsWith('--seed=')) seed = Number(arg.slice(7));
    else if (arg.startsWith('--show=')) show = Number(arg.slice(7));
    else {
      console.error(`Tham so la "${arg}" (chi co --seed=N va --show=N)`);
      process.exit(1);
    }
  }
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    console.error('--seed phai la so nguyen tu 0 den 4294967295');
    process.exit(1);
  }
  if (!Number.isInteger(show) || show < 0 || show > 200) {
    console.error('--show phai la so nguyen tu 0 den 200');
    process.exit(1);
  }
  return { seed, show };
}

const fmt = (x: number | null, d = 2) => (x === null ? ' n/a' : x.toFixed(d));

function describe(r: RankedCandidate): string {
  const c = r.components;
  return (
    `#${r.rank} ${r.userId} diem ${r.score === null ? 'n/a' : r.score.toFixed(0)} (${r.confidenceLevel}, ` +
    `kn ${fmt(c.experience.value)} tc ${fmt(c.reliability.value)} kd ${fmt(c.availability.value)}, ` +
    `tai ${r.load}/${r.capacity})${r.flags.length ? ' [' + r.flags.join(',') + ']' : ''}`
  );
}

function main() {
  const { seed, show } = parseArgs(process.argv.slice(2));
  const data = generateSimulation({ ...DEFAULT_SIM, seed });
  const days = data.config.days;
  const at = (d: number, h = 0, m = 0) => simDayToDate(vnToday(), days, d, h, m);

  // ---------- (1) The dang mo hom nay ----------
  const open = data.cards.filter((c) => !c.done);
  const today = availableAt(data.people, days).map((p) => ({ key: p.key, capacity: p.capacity }));
  console.log(`Bo du lieu: hat giong ${seed} - ${data.people.length} nguoi, ${data.cards.length} the, ${open.length} the dang mo.`);
  console.log(`Ung vien hom nay: ${today.map((p) => p.key).join(', ')}\n`);

  for (const c of open.slice(0, show)) {
    const snap = snapshotAsOf(data, days, 12, today, c.key);
    const ranked = rankCandidates(
      { id: c.key, title: c.title, description: c.description, startDate: at(c.assignedDay), dueDate: at(c.dueDay, 23, 59) },
      snap.candidates,
      { idf: snap.idf, now: snap.now, groupOnTimeRate: snap.mu }
    );
    const skills = today
      .map((p) => `${p.key}:${skillAt(data.people.find((q) => q.key === p.key)!, c.topic, days).toFixed(2)}`)
      .join(' ');
    console.log(`${c.key} "${c.title}" | chu de AN: ${TOPICS[c.topic]!.name}${c.ambiguous ? ' (MO HO)' : ''}`);
    console.log(`   ky nang AN: ${skills}  | dang giao cho: ${c.assigneeKey}`);
    for (const r of ranked.slice(0, 3)) console.log(`   ${describe(r)}`);
    const top = ranked[0]!;
    for (const e of top.evidence.slice(0, 2)) {
      console.log(`      bang chung: "${e.title}" giong ${e.sim.toFixed(2)}, ${e.outcome}`);
    }
  }

  // ---------- (2) Phat lai lich su ----------
  console.log('\n===== PHAT LAI LICH SU (kiem tra nhanh, KHONG phai danh gia) =====');
  const seeds = [DEFAULT_SIM.seed, 1, 2, 3, 4, 5, 6];
  const rows: ReturnType<typeof replay>[] = [];
  for (const s of seeds) rows.push(replay(generateSimulation({ ...DEFAULT_SIM, seed: s })));
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const sd = (a: number[]) => {
    const m = mean(a);
    return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1));
  };
  const line = (name: string, f: (r: (typeof rows)[number]) => number, pct = false) => {
    const xs = rows.map(f);
    const k = pct ? 100 : 1;
    console.log(
      `  ${name.padEnd(46)} ${(mean(xs) * k).toFixed(pct ? 1 : 2).padStart(6)}${pct ? '%' : ' '}  (sd ${(sd(xs) * k).toFixed(pct ? 1 : 2)}; ${xs.map((x) => (x * k).toFixed(pct ? 0 : 2)).join(' ')})`
    );
  };
  console.log(`So the phat lai moi hat giong: ${rows.map((r) => r.n).join(', ')} (chi the giao tu ngay 60 tro di)`);
  line('top-1 trung dap an tot nhat - bo cham', (r) => r.hitScorer, true);
  line('top-1 trung dap an tot nhat - phan cong that', (r) => r.hitActual, true);
  line('top-1 trung dap an tot nhat - ngau nhien (ky vong)', (r) => r.hitRandom, true);
  line('do hoi tiec (ky nang) - bo cham', (r) => r.regretScorer);
  line('do hoi tiec (ky nang) - phan cong that', (r) => r.regretActual);
  line('do hoi tiec (ky nang) - ngau nhien (ky vong)', (r) => r.regretRandom);
  line('nguoi xep dau la nguoi CHUA CO LICH SU (NO_HISTORY)', (r) => r.topNoHistory, true);
  line('nguoi xep dau co do tin cay MONG (THIN)', (r) => r.topThin, true);
  line('so ung vien trung binh trong ho boi', (r) => r.poolSize);

  // ---------- (3) Tach thanh phan ----------
  console.log('\n===== TACH THANH PHAN (trung binh 7 hat giong, cung tap tinh huong) =====');
  const datasets = seeds.map((s) => generateSimulation({ ...DEFAULT_SIM, seed: s }));
  const variants: [string, Weights | undefined][] = [
    ['mac dinh 0,45 / 0,30 / 0,25', undefined],
    ['chi kinh nghiem   1 / 0 / 0', { experience: 1, reliability: 0, availability: 0 }],
    ['chi tin cay       0 / 1 / 0', { experience: 0, reliability: 1, availability: 0 }],
    ['chi kha dung      0 / 0 / 1', { experience: 0, reliability: 0, availability: 1 }],
    ['kinh nghiem + tin cay 0,6 / 0,4 / 0', { experience: 0.6, reliability: 0.4, availability: 0 }],
  ];
  for (const [name, weights] of variants) {
    const rs = datasets.map((d) => replay(d, { weights }));
    console.log(
      `  ${name.padEnd(40)} top-1 ${(mean(rs.map((r) => r.hitScorer)) * 100).toFixed(1).padStart(5)}%   hoi tiec ${mean(rs.map((r) => r.regretScorer)).toFixed(3)}`
    );
  }
  const base = datasets.map((d) => replay(d));
  console.log(
    `  (tham chieu) phan cong that trong lich su      top-1 ${(mean(base.map((r) => r.hitActual)) * 100).toFixed(1).padStart(5)}%   hoi tiec ${mean(base.map((r) => r.regretActual)).toFixed(3)}`
  );
  console.log(
    `  (tham chieu) ngau nhien                        top-1 ${(mean(base.map((r) => r.hitRandom)) * 100).toFixed(1).padStart(5)}%   hoi tiec ${mean(base.map((r) => r.regretRandom)).toFixed(3)}`
  );

  // ---------- (4) Do phan tan ----------
  console.log('\n===== DO PHAN TAN GIUA CAC UNG VIEN CUA CUNG MOT THE (7 hat giong) =====');
  console.log('  Anh huong THUC TE len thu tu xep hang ~ trong so x do lech chuan (khong phai chi trong so).');
  const sp = componentSpread(datasets);
  const names = ['experience', 'reliability', 'availability'] as const;
  const influence = names.map((k) => DEFAULT_WEIGHTS[k] * sp[k].sd);
  const total = influence.reduce((a, b) => a + b, 0);
  console.log('  thanh phan     trung binh   do lech chuan   khoang    tuong quan voi ky nang   trong so   anh huong thuc te');
  names.forEach((k, i) => {
    const s = sp[k];
    console.log(
      `  ${k.padEnd(13)} ${s.mean.toFixed(3).padStart(9)}   ${s.sd.toFixed(3).padStart(12)}   ${s.range.toFixed(3).padStart(6)}   ${s.corrWithSkill.toFixed(3).padStart(20)}   ${DEFAULT_WEIGHTS[k].toFixed(2).padStart(8)}   ${((influence[i]! / total) * 100).toFixed(0).padStart(11)}%`
    );
  });
}

main();
