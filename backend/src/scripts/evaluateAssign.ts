// Script danh gia module goi y phan cong (buoc 7, ASSIGN_MODULE.md §11). CHAY TAY, khong nam trong bo test:
//
//   npm run eval:assign -- --exp=arms
//   npm run eval:assign -- --exp=arms --seeds=5 --out=eval-assign-result.md
//
//   --exp=arms                so sanh cac nhanh (vong kin + doi chieu phat lai lich su) - buoc 7a
//   --seeds=N                 so hat giong (2..20, mac dinh 20: 2001..2000+N)
//   --out=FILE                ghi them bao cao markdown ra FILE va du lieu tho (tung hat giong) ra FILE.json
//
// KHONG ghi DB, KHONG import prisma, KHONG mang. Chay tuan tu, tat dinh: cung tham so -> cung so.

import fs from 'node:fs';
import { ABLATION_ARMS, MAIN_ARMS, type Arm, type ArmSpec } from './evalAssignArms';
import { buildArmsReport, datasetFingerprint, type ArmResult, type ReportMeta } from './evalAssignReport';
import { DEFAULT_MIN_DAY, EVAL_SEEDS, bestSkillArm, oracleArm, runArm, type RunMode } from './evalAssignRun';
import { DEFAULT_LOAD_PENALTY, DEFAULT_SIM, generateSimulation, type SimDataset } from './simGenerator';

interface Args {
  exp: 'arms';
  seeds: number;
  out: string | null;
}

function fail(message: string): never {
  console.error(`Loi tham so: ${message}`);
  process.exit(1);
}

function parseArgs(argv: string[]): Args {
  const opts = new Map<string, string>();
  for (const a of argv) {
    const m = /^--([a-z-]+)=(.*)$/.exec(a);
    if (!m) fail(`khong hieu "${a}" (dung --ten=gia-tri)`);
    opts.set(m[1]!, m[2]!);
  }
  for (const k of opts.keys()) if (!['exp', 'seeds', 'out'].includes(k)) fail(`tham so la "--${k}"`);
  const exp = opts.get('exp') ?? 'arms';
  if (exp !== 'arms') fail(`--exp phai la arms, nhan "${exp}"`);
  const seeds = Number(opts.get('seeds') ?? String(EVAL_SEEDS.length));
  if (!Number.isInteger(seeds) || seeds < 2 || seeds > EVAL_SEEDS.length) fail(`--seeds phai la so nguyen 2..${EVAL_SEEDS.length}`);
  return { exp, seeds, out: opts.get('out') ?? null };
}

function runAll(specs: readonly ArmSpec[], datasets: readonly SimDataset[], mode: RunMode): ArmResult[] {
  return specs.map((spec) => {
    const t0 = Date.now();
    const perSeed = datasets.map((d) => runArm(d, spec.make, { mode }).summary);
    console.error(`[${mode}] ${spec.id}: ${datasets.length} hat giong, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    return { id: spec.id, label: spec.label, perSeed };
  });
}

/** Nhanh tham chieu cung la mot ArmSpec: id / nhan lay tu chinh nhanh. */
const refSpec = (make: () => Arm): ArmSpec => {
  const a = make();
  return { id: a.id, label: a.label, make };
};

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const seeds = EVAL_SEEDS.slice(0, args.seeds);
  const datasets = seeds.map((seed) => generateSimulation({ ...DEFAULT_SIM, seed }));
  const finger = datasetFingerprint(datasets);

  const refSpecs = [refSpec(bestSkillArm), refSpec(oracleArm)];
  const closed = runAll([...MAIN_ARMS, ...ABLATION_ARMS, ...refSpecs], datasets, 'ARM');
  const history = runAll([...MAIN_ARMS, ...refSpecs], datasets, 'HISTORY');

  const meta: ReportMeta = {
    date: new Date().toISOString().slice(0, 10),
    seeds,
    datasetSha256: finger.combined,
    minDay: DEFAULT_MIN_DAY,
    loadPenalty: DEFAULT_LOAD_PENALTY,
  };
  const report = buildArmsReport({ meta, closed, history });
  console.log(report);
  if (args.out !== null) {
    fs.writeFileSync(args.out, report, 'utf8');
    fs.writeFileSync(`${args.out}.json`, JSON.stringify({ meta, datasetSha256PerSeed: finger.perSeed, closed, history }), 'utf8');
    console.error(`Da ghi ${args.out} va ${args.out}.json`);
  }
}

main();
