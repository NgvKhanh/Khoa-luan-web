// Bo danh gia chatbot (CHATBOT_MODULE.md §14): bo du lieu nhat quan + dong bang, chi so tinh dung, va duong
// xu ly cua bo danh gia TRUNG voi dich vu that (handleMessage tren CSDL). Test nay KHONG do chat luong.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { foldText, normalizeText } from '../src/modules/ai/ai.rules';
import type { FollowUpContext } from '../src/modules/chat/chat.followup';
import { resolveSlots, type ParsedQuestion } from '../src/modules/chat/chat.intent';
import { LlmBudget, PROMPT_EXAMPLES } from '../src/modules/chat/chat.llm';
import { matchMember } from '../src/modules/chat/chat.members';
import { parseByRules } from '../src/modules/chat/chat.rules';
import { handleMessage, understandByRules } from '../src/modules/chat/chat.service';
import { ChatSessionStore } from '../src/modules/chat/chat.session';
import {
  armParse,
  confusionOf,
  fullMatchCI,
  labelOf,
  macroF1,
  outcomeKey,
  outcomeOf,
  pairedFull,
  perItemFull,
  runArm,
  scoreItem,
  summarizeArm,
  type GoldOutcome,
  type Outcome,
  type ScoredRun,
} from '../src/scripts/chatEvalCore';
import { CHAT_EVAL_ITEMS, EVAL_ROSTER, type ChatEvalItem } from '../src/scripts/chatEvalDataset';
import { buildChatReport, describeOutcome, isPlain, type ChatReportMeta } from '../src/scripts/chatEvalReport';
import { parseArgs } from '../src/scripts/evaluateChat';
import { makeDirectUser } from './helpers';

const prevOf = (i: ChatEvalItem): FollowUpContext | null =>
  i.prev === null ? null : { intent: i.prev.intent, period: i.prev.period, focus: i.prev.focus, memberUserId: i.prev.member };
const P = (over: Partial<ParsedQuestion> = {}): ParsedQuestion => ({ intent: 'MY_TASKS', period: null, focus: null, member: null, ...over });
const fold = (s: string) => foldText(normalizeText(s).toLowerCase()).split(/\s+/).join(' ').trim();

describe('bo du lieu danh gia chatbot', () => {
  it('cau truc: 98 cau / 8 nhom, id duy nhat theo tien to nhom, dev = cau 1, 4, 7... cua moi nhom (35 dev / 63 test)', () => {
    expect(CHAT_EVAL_ITEMS).toHaveLength(98);
    expect(new Set(CHAT_EVAL_ITEMS.map((i) => i.id)).size).toBe(98);
    const byGroup = (g: string) => CHAT_EVAL_ITEMS.filter((i) => i.group === g);
    const prefix: Record<string, string> = {
      MY_TASKS: 'A',
      MY_PRIORITIES: 'B',
      MEMBER_TASKS: 'C',
      TEAM_SUMMARY: 'D',
      TEAM_WORKLOAD: 'E',
      FOLLOW_UP: 'F',
      OUT_OF_SCOPE: 'G',
      INJECTION: 'H',
    };
    expect(Object.keys(prefix).map((g) => byGroup(g).length)).toEqual([13, 11, 21, 13, 11, 14, 9, 6]);
    for (const [g, p] of Object.entries(prefix)) {
      byGroup(g).forEach((item, i) => {
        expect(item.id).toBe(`${p}${String(i + 1).padStart(2, '0')}`);
        expect(item.split).toBe(i % 3 === 0 ? 'dev' : 'test');
      });
    }
    expect(CHAT_EVAL_ITEMS.filter((i) => i.split === 'dev')).toHaveLength(35);
    // moi nhom deu co o ca hai tap
    for (const g of Object.keys(prefix)) expect(new Set(byGroup(g).map((i) => i.split))).toEqual(new Set(['dev', 'test']));
  });

  it('danh sach nguoi: 12 nguoi, id duy nhat; co trung ten "Lan" va cac ten trung tu thuong (Tuấn, Mai, Nam, An, Bình, Minh, Thắng, Huy)', () => {
    expect(EVAL_ROSTER).toHaveLength(12);
    expect(new Set(EVAL_ROSTER.map((m) => m.userId)).size).toBe(12);
    expect(matchMember('Lan', EVAL_ROSTER)).toMatchObject({ kind: 'MANY' });
    for (const name of ['Tuấn', 'Mai', 'Nam', 'An', 'Bình', 'Minh', 'Thắng', 'Huy']) {
      expect(matchMember(name, EVAL_ROSTER), name).toMatchObject({ kind: 'ONE' });
    }
  });

  it('nhan vang hop le: truy van da o dang CHUAN (diem bat dong cua resolveSlots), nguoi / ung vien / ngu canh deu thuoc danh sach', () => {
    const ids = new Set(EVAL_ROSTER.map((m) => m.userId));
    const problems: string[] = [];
    for (const item of CHAT_EVAL_ITEMS) {
      const g = item.gold;
      if (g.kind === 'QUERY') {
        const r = resolveSlots({ intent: g.intent, period: g.period, focus: g.focus, memberText: null, memberUserId: g.member });
        if (r.period !== g.period || r.focus !== g.focus) problems.push(`${item.id}: khong o dang chuan (${r.period}/${r.focus})`);
        if ((g.intent === 'MEMBER_TASKS') !== (g.member !== null)) problems.push(`${item.id}: member chi co o MEMBER_TASKS`);
        if (g.member !== null && !ids.has(g.member)) problems.push(`${item.id}: member la`);
        if (g.ignored.some((s) => !['period', 'focus', 'member'].includes(s))) problems.push(`${item.id}: ignored la`);
      }
      if (g.kind === 'CLARIFY_MEMBER' && (g.candidates.length < 2 || g.candidates.some((c) => !ids.has(c)))) problems.push(`${item.id}: ung vien`);
      if (item.prev?.member && !ids.has(item.prev.member)) problems.push(`${item.id}: prev.member la`);
      if (item.question.trim() === '' || item.question.length > 500) problems.push(`${item.id}: do dai cau hoi`);
    }
    expect(problems).toEqual([]);
    // Nhom cau noi tiep deu co ngu canh truoc, tru dung 1 cau "noi tiep ma khong co ngu canh" -> UNSUPPORTED
    const follow = CHAT_EVAL_ITEMS.filter((i) => i.group === 'FOLLOW_UP');
    expect(follow.filter((i) => i.prev === null).map((i) => [i.id, i.gold.kind])).toEqual([['F12', 'UNSUPPORTED']]);
    expect(CHAT_EVAL_ITEMS.filter((i) => i.group !== 'FOLLOW_UP' && i.prev !== null)).toEqual([]);
    // Du 6 nhan y dinh o CA HAI tap
    for (const split of ['dev', 'test'] as const) {
      expect(new Set(CHAT_EVAL_ITEMS.filter((i) => i.split === split).map((i) => labelOf(i.gold)))).toEqual(
        new Set(['MY_TASKS', 'MY_PRIORITIES', 'MEMBER_TASKS', 'TEAM_SUMMARY', 'TEAM_WORKLOAD', 'UNSUPPORTED'])
      );
    }
  });

  it('khong cau nao trung vi du trong prompt (so khong dau, bo khoang trang thua) - tranh do tren chinh vi du da day LLM', () => {
    const examples = new Set(PROMPT_EXAMPLES.map((e) => fold(e.question)));
    expect(CHAT_EVAL_ITEMS.filter((i) => examples.has(fold(i.question))).map((i) => i.id)).toEqual([]);
  });

  it('DONG BANG: dau van tay sha256 cua danh sach nguoi + toan bo cau hoi / nhan vang / ngu canh / tap', () => {
    // Khi CO CHU Y sua (vd sau khi duyet nhan tren tap dev): xac nhan sua dung y roi chep gia tri moi vao day.
    // Sua SAU khi da chay tap test thi phai ghi ro trong bao cao / luan van (§14.5).
    const hash = createHash('sha256').update(JSON.stringify({ roster: EVAL_ROSTER, items: CHAT_EVAL_ITEMS })).digest('hex');
    expect(hash).toBe('966cbe7ae85a7f38ab563a6e7a55324f7f97ea094703a6531147ffc42b450570');
  });
});

describe('loi cham diem (ham thuan)', () => {
  const roster = EVAL_ROSTER;

  it('outcomeOf: truy van / chua ho tro / hoi "ai?" / hoi lai trung ten / khong tim thay / cau noi tiep giu nguoi', () => {
    expect(outcomeOf(P({ focus: 'OVERDUE' }), null, roster)).toEqual({ kind: 'QUERY', intent: 'MY_TASKS', period: null, focus: 'OVERDUE', member: null, ignored: [] });
    expect(outcomeOf(P({ intent: 'UNSUPPORTED' }), null, roster)).toEqual({ kind: 'UNSUPPORTED' });
    expect(outcomeOf(P({ intent: 'NONE', period: 'NEXT_WEEK' }), null, roster)).toEqual({ kind: 'UNSUPPORTED' });
    expect(outcomeOf(P({ intent: 'MEMBER_TASKS' }), null, roster)).toEqual({ kind: 'ASK_WHO' });
    expect(outcomeOf(P({ intent: 'MEMBER_TASKS', member: 'Lan' }), null, roster)).toEqual({ kind: 'CLARIFY_MEMBER', candidates: ['r01', 'r02'] });
    expect(outcomeOf(P({ intent: 'MEMBER_TASKS', member: 'Hưng' }), null, roster)).toEqual({ kind: 'MEMBER_NOT_FOUND' });
    expect(outcomeOf(P({ intent: 'MEMBER_TASKS', member: 'Trần Lan', focus: 'DONE', period: 'NEXT_WEEK' }), null, roster)).toEqual({
      kind: 'QUERY',
      intent: 'MEMBER_TASKS',
      period: 'THIS_WEEK',
      focus: 'DONE',
      member: 'r02',
      ignored: ['period'],
    });
    const prev: FollowUpContext = { intent: 'MEMBER_TASKS', period: null, focus: 'OPEN', memberUserId: 'r03' };
    expect(outcomeOf(P({ intent: 'NONE', focus: 'OVERDUE' }), prev, roster)).toMatchObject({ kind: 'QUERY', member: 'r03', focus: 'OVERDUE' });
    // nguoi da chon khong con trong danh sach -> khong tim thay
    expect(outcomeOf(P({ intent: 'NONE', focus: 'OVERDUE' }), { ...prev, memberUserId: 'da-roi-nhom' }, roster)).toEqual({ kind: 'MEMBER_NOT_FOUND' });
    // ten nguoi o y dinh khong phai MEMBER_TASKS -> bo qua 'member'
    expect(outcomeOf(P({ intent: 'TEAM_SUMMARY', member: 'Lan' }), null, roster)).toMatchObject({ kind: 'QUERY', member: null, ignored: ['member'] });
  });

  it('armParse / runArm: B0 = luat; B1 = LLM, LLM loi -> LLM_FAILED; B2 = gop, LLM loi -> luat', () => {
    const rules = P({ intent: 'MEMBER_TASKS', period: 'NEXT_WEEK', member: 'lan' });
    const llmOk = { ok: true as const, parsed: P({ intent: 'MEMBER_TASKS', period: 'THIS_WEEK', focus: 'OPEN', member: 'Lan ơi' }) };
    const llmBad = { ok: false as const, reason: 'TIMEOUT' };
    expect(armParse('B0', rules, null, roster)).toBe(rules);
    expect(armParse('B1', rules, llmOk, roster)).toBe(llmOk.parsed);
    expect(armParse('B1', rules, llmBad, roster)).toBeNull();
    expect(armParse('B2', rules, llmOk, roster)).toEqual({ intent: 'MEMBER_TASKS', period: 'NEXT_WEEK', focus: 'OPEN', member: 'lan' });
    expect(armParse('B2', rules, llmBad, roster)).toBe(rules);
    expect(() => armParse('B1', rules, null, roster)).toThrow();
    expect(runArm('B1', rules, llmBad, null, roster)).toEqual({ kind: 'LLM_FAILED', reason: 'TIMEOUT' });
    expect(runArm('B2', rules, llmBad, null, roster)).toEqual({ kind: 'CLARIFY_MEMBER', candidates: ['r01', 'r02'] });
  });

  it('scoreItem: tung truong + khop hoan toan + tham so bo qua + hoi lai', () => {
    const gold: GoldOutcome = { kind: 'QUERY', intent: 'MEMBER_TASKS', period: 'THIS_WEEK', focus: 'DONE', member: 'r03', ignored: [] };
    const same = scoreItem(gold, { ...gold });
    expect(same).toEqual({ intent: true, period: true, focus: true, member: true, full: true, ignored: true, clarify: null });
    expect(scoreItem(gold, { ...gold, ignored: ['period'] })).toMatchObject({ full: true, ignored: false });
    expect(scoreItem(gold, { ...gold, period: 'LAST_WEEK' })).toMatchObject({ intent: true, period: false, focus: true, member: true, full: false, ignored: null });
    expect(scoreItem(gold, { ...gold, member: 'r04' })).toMatchObject({ member: false, full: false });
    expect(scoreItem(gold, { kind: 'MEMBER_NOT_FOUND' })).toMatchObject({ intent: true, period: false, focus: false, member: false, full: false });
    expect(scoreItem(gold, { kind: 'LLM_FAILED', reason: 'X' })).toMatchObject({ intent: false, period: false, member: false, full: false });
    const clarify: GoldOutcome = { kind: 'CLARIFY_MEMBER', candidates: ['r01', 'r02'] };
    expect(scoreItem(clarify, { kind: 'CLARIFY_MEMBER', candidates: ['r02', 'r01'] })).toEqual({
      intent: true,
      period: null,
      focus: null,
      member: true,
      full: true,
      ignored: null,
      clarify: true,
    });
    expect(scoreItem(clarify, { ...gold })).toMatchObject({ intent: true, member: false, full: false, clarify: false });
    expect(scoreItem({ kind: 'UNSUPPORTED' }, { kind: 'UNSUPPORTED' })).toEqual({ intent: true, period: null, focus: null, member: null, full: true, ignored: null, clarify: null });
    expect(scoreItem({ kind: 'ASK_WHO' }, { kind: 'MEMBER_NOT_FOUND' })).toMatchObject({ intent: true, member: false, full: false, clarify: false });
    expect(outcomeKey({ kind: 'QUERY', intent: 'MY_TASKS', period: null, focus: 'OPEN', member: null, ignored: ['period'] })).toBe(
      outcomeKey({ kind: 'QUERY', intent: 'MY_TASKS', period: null, focus: 'OPEN', member: null, ignored: [] })
    );
  });

  it('macro-F1 + ma tran nham tinh tay; LLM_FAILED giam recall, khong cong precision', () => {
    const q = (intent: 'MY_TASKS' | 'TEAM_SUMMARY'): Outcome => ({ kind: 'QUERY', intent, period: null, focus: 'OPEN', member: null, ignored: [] });
    const runs: ScoredRun[] = [
      ['MY_TASKS', q('MY_TASKS')],
      ['MY_TASKS', q('MY_TASKS')],
      ['MY_TASKS', q('TEAM_SUMMARY')],
      ['MY_TASKS', { kind: 'LLM_FAILED', reason: 'TIMEOUT' }],
      ['TEAM_SUMMARY', q('TEAM_SUMMARY')],
    ].map(([g, pred], i) => {
      const gold = q(g as 'MY_TASKS' | 'TEAM_SUMMARY') as GoldOutcome;
      return { itemId: `I${i}`, run: 1, gold, pred: pred as Outcome, score: scoreItem(gold, pred as Outcome) };
    });
    const conf = confusionOf(runs);
    expect(conf.MY_TASKS).toMatchObject({ MY_TASKS: 2, TEAM_SUMMARY: 1, LLM_FAILED: 1 });
    expect(conf.TEAM_SUMMARY).toMatchObject({ TEAM_SUMMARY: 1, MY_TASKS: 0 });
    const f = macroF1(conf);
    // MY_TASKS: P = 2/2, R = 2/4 -> F1 = 2/3; TEAM_SUMMARY: P = 1/2, R = 1/1 -> F1 = 2/3; 4 nhan con lai khong co nhan vang
    expect(f.perLabel.MY_TASKS).toBeCloseTo(2 / 3, 10);
    expect(f.perLabel.TEAM_SUMMARY).toBeCloseTo(2 / 3, 10);
    expect(f.perLabel.UNSUPPORTED).toBeNull();
    expect(f.macro).toBeCloseTo(2 / 3, 10);
    const s = summarizeArm(runs);
    expect([s.intent.hits, s.intent.n, s.full.hits, s.llmFailed]).toEqual([3, 5, 3, 1]);
    // mau so chi gom cac o AP DUNG: khong cau nao ve mot nguoi / hoi lai; "tham so bo qua" chi xet 3 cau khop hoan toan
    expect([s.period.n, s.member.n, s.clarify.n, s.ignored.n]).toEqual([5, 0, 0, 3]);
    expect([s.member.rate, s.clarify.rate]).toEqual([null, null]);
  });

  it('diem theo cau = trung binh qua cac lan chay; KTC bootstrap tat dinh; so sanh cap dung dau', () => {
    const gold: GoldOutcome = { kind: 'UNSUPPORTED' };
    const good: Outcome = { kind: 'UNSUPPORTED' };
    const bad: Outcome = { kind: 'ASK_WHO' };
    const mk = (pattern: Outcome[][]): ScoredRun[] =>
      pattern.flatMap((preds, i) => preds.map((pred, run) => ({ itemId: `I${i}`, run: run + 1, gold, pred, score: scoreItem(gold, pred) })));
    const a = mk([[good, good, bad], [good, good, good], [bad, bad, bad], [good, bad, good]]);
    const b = mk([[bad], [good], [bad], [bad]]);
    const ids = ['I0', 'I1', 'I2', 'I3'];
    expect(perItemFull(a, ids)).toEqual([2 / 3, 1, 0, 2 / 3]);
    expect(perItemFull(b, ids)).toEqual([0, 1, 0, 0]);
    expect(() => perItemFull(a, [...ids, 'I9'])).toThrow();
    const ci = fullMatchCI(a, ids)!;
    expect(ci.mean).toBeCloseTo(7 / 12, 10);
    expect(ci.lo).toBeLessThanOrEqual(ci.mean);
    expect(ci.hi).toBeGreaterThanOrEqual(ci.mean);
    expect(fullMatchCI(a, ids)).toEqual(ci); // cung hat giong -> cung khoang
    const d = pairedFull(a, b, ids)!;
    expect(d.mean).toBeCloseTo(7 / 12 - 1 / 4, 10);
    expect([d.positive, d.negative, d.ties]).toEqual([2, 0, 2]);
    expect(fullMatchCI(a, ['I0'])).toBeNull();
  });
});

describe('bao cao + tham so dong lenh', () => {
  it('bao cao: bang tong quan, so sanh cap, ma tran nham, theo nhom / loai kho, lop LLM, danh sach cau sai', () => {
    const items = CHAT_EVAL_ITEMS.filter((i) => ['A01', 'C04', 'G01'].includes(i.id));
    const b0: ScoredRun[] = items.map((i) => {
      const pred = runArm('B0', parseByRules(i.question, EVAL_ROSTER), null, prevOf(i), EVAL_ROSTER);
      return { itemId: i.id, run: 1, gold: i.gold, pred, score: scoreItem(i.gold, pred) };
    });
    const b1: ScoredRun[] = items.map((i) => {
      const pred: Outcome = { kind: 'LLM_FAILED', reason: 'TIMEOUT' };
      return { itemId: i.id, run: 1, gold: i.gold, pred, score: scoreItem(i.gold, pred) };
    });
    const meta: ChatReportMeta = {
      date: '2026-09-29',
      split: 'dev',
      runs: 1,
      arms: ['B0', 'B1'],
      provider: 'nha-cung-cap',
      model: 'model-gia',
      datasetVersion: 'd',
      promptVersion: 'p',
      rulesVersion: 'r',
      apiCalls: 3,
      cacheHits: 0,
      aborted: null,
    };
    const obs = items.map((i) => ({ itemId: i.id, run: 1, ok: false, reason: 'TIMEOUT', formatMode: 'json_schema', latencyMs: 8000, promptTokens: null, completionTokens: null, fromCache: false }));
    const md = buildChatReport(meta, new Map([['B0', b0], ['B1', b1]]), items, obs);
    for (const part of [
      '## Tổng quan theo nhánh',
      '| B0 | 100,0% (3/3)',
      '| B1 | 0,0% (0/3)',
      '## So sánh cặp (cùng câu hỏi)',
      '| B1 − B0 | -100,0 điểm %',
      '### Ma trận nhầm — B1',
      '## Khớp hoàn toàn theo nhóm câu hỏi',
      '## Khớp hoàn toàn theo loại khó',
      '| Lỗi theo loại | TIMEOUT 3 |',
      '## Câu sai — B0 (0)',
      '## Câu sai — B1 (3)',
      '| C04 | 1 | Lan đang làm gì? | hỏi lại: r01, r02 | LLM lỗi (TIMEOUT) |',
    ]) {
      expect(md, part).toContain(part);
    }
    expect(describeOutcome({ kind: 'QUERY', intent: 'MY_TASKS', period: null, focus: 'OPEN', member: null, ignored: ['period'] })).toBe('MY_TASKS · OPEN · – · – (bỏ qua period)');
    expect([isPlain('viec cua toi qua han'), isPlain('Việc của tôi'), isPlain('ABC xyz')]).toEqual([true, false, true]);
  });

  it('parseArgs: mac dinh B0 + dev; all = B0,B1,B2; danh sach; runs / delay / items', () => {
    expect(parseArgs([])).toEqual({ arms: ['B0'], split: 'dev', runs: 1, delayMs: 4000, items: null, out: null, cacheDir: '.chat-eval-cache' });
    expect(parseArgs(['--arm=all', '--split=test', '--runs=3', '--delay=5000', '--out=x.md'])).toMatchObject({
      arms: ['B0', 'B1', 'B2'],
      split: 'test',
      runs: 3,
      delayMs: 5000,
      out: 'x.md',
    });
    expect(parseArgs(['--arm=B2,B0,B2', '--items=A01, C04'])).toMatchObject({ arms: ['B2', 'B0'], items: ['A01', 'C04'] });
  });
});

describe('duong xu ly cua bo danh gia TRUNG voi dich vu that', () => {
  it('B0 tren ca 98 cau: outcomeOf(parseByRules) = ket qua handleMessage (pham vi WORKSPACE, CSDL that, ngu canh vang dat vao phien)', async () => {
    const owner = await makeDirectUser('Zed Owner');
    const people = [];
    for (const m of EVAL_ROSTER) people.push({ rosterId: m.userId, user: await makeDirectUser(m.name) });
    const ws = await prisma.workspace.create({
      data: {
        ownerId: owner.id,
        name: 'Nhóm Đánh Giá',
        members: { create: [{ userId: owner.id, role: 'OWNER' }, ...people.map((p) => ({ userId: p.user.id, role: 'MEMBER' as const }))] },
      },
      select: { id: true },
    });
    const toDb = new Map(people.map((p) => [p.rosterId, p.user.id]));
    const nameOf = new Map(EVAL_ROSTER.map((m) => [m.userId, m.name]));
    const now = new Date('2026-09-30T03:00:00.000Z');
    const llmOff = { cfg: { baseUrl: '', apiKey: '', model: '', timeoutMs: 1 }, budget: new LlmBudget(), formatModes: new Map() };

    // Danh sach nguoi cua dich vu = 12 nguoi + chu khong gian (ten khong trung tu nao trong cau hoi)
    const roster = [...EVAL_ROSTER, { userId: 'owner', name: 'Zed Owner' }];
    const mismatches: unknown[] = [];
    const kinds = new Set<string>();

    /** Mot luot qua dich vu that; `parsed` = ket qua hieu cau tiem vao (kieu LLM), bo trong = bo luat. */
    async function check(label: string, question: string, prev: ChatEvalItem['prev'], parsed?: ParsedQuestion) {
      const prevCtx: FollowUpContext | null = prev === null ? null : { intent: prev.intent, period: prev.period, focus: prev.focus, memberUserId: prev.member };
      const expected = outcomeOf(parsed ?? parseByRules(question, roster), prevCtx, roster);
      kinds.add(expected.kind);
      const sessions = new ChatSessionStore();
      const { id, state } = sessions.create(owner.id, `WORKSPACE:${ws.id}`, now.getTime());
      if (prevCtx) state.context = { ...prevCtx, memberUserId: prev!.member === null ? null : toDb.get(prev!.member)! };
      const understand = parsed ? async () => ({ parsed, parser: 'LLM' as const }) : understandByRules;
      const r = await handleMessage(
        owner.id,
        { message: question, scope: { kind: 'WORKSPACE', workspaceId: ws.id }, conversationId: id },
        { now, sessions, understand, llm: llmOff }
      );
      let got: string;
      if (r.answer.kind === 'UNSUPPORTED') got = 'UNSUPPORTED';
      else if (r.answer.clarify?.question === 'Bạn muốn hỏi về ai?') got = 'ASK_WHO';
      else if (r.answer.kind === 'CLARIFY') got = `CLARIFY:${r.answer.clarify!.options.map((o) => o.label).sort().join(',')}`;
      else if (r.answer.text.startsWith('Không tìm thấy')) got = 'MEMBER_NOT_FOUND';
      else got = `QUERY|${r.understood.intent}|${r.understood.period}|${r.understood.focus}|${r.understood.memberName}|${r.answer.ignoredSlots.join(',')}`;
      let want: string;
      if (expected.kind === 'QUERY') want = `QUERY|${expected.intent}|${expected.period}|${expected.focus}|${expected.member === null ? null : nameOf.get(expected.member)}|${expected.ignored.join(',')}`;
      else if (expected.kind === 'CLARIFY_MEMBER') want = `CLARIFY:${expected.candidates.map((c) => nameOf.get(c)).sort().join(',')}`;
      else want = expected.kind;
      if (got !== want) mismatches.push({ label, question, want, got });
    }

    for (const item of CHAT_EVAL_ITEMS) await check(item.id, item.question, item.prev);

    // Ket qua kieu LLM (bo luat khong bao gio sinh ra): hoi "ai?", ten la, xung ho, ten ngoai y dinh, NONE...
    const P2 = (over: Partial<ParsedQuestion>): ParsedQuestion => ({ intent: 'MEMBER_TASKS', period: null, focus: null, member: null, ...over });
    const memberCtx = { intent: 'MEMBER_TASKS' as const, period: null, focus: 'OPEN' as const, member: 'r03' };
    const synthetic: Array<[string, ParsedQuestion, ChatEvalItem['prev']]> = [
      ['hoi ai', P2({}), null],
      ['xung ho', P2({ member: 'anh ấy' }), null],
      ['ten kem tu cam than', P2({ member: 'Lan ơi' }), null],
      ['chi Mai + DONE tuong lai', P2({ member: 'chị Mai', focus: 'DONE', period: 'NEXT_WEEK' }), null],
      ['ho ten day du', P2({ member: 'Nguyễn Thị Lan', focus: 'OVERDUE', period: 'TODAY' }), null],
      ['noi tiep giu nguoi', P2({ intent: 'NONE', focus: 'OVERDUE' }), memberCtx],
      ['noi tiep doi nguoi', P2({ intent: 'NONE', member: 'Lan' }), memberCtx],
      ['noi tiep tu nhac minh', P2({ intent: 'NONE', member: 'tôi' }), { intent: 'TEAM_SUMMARY', period: 'LAST_WEEK', focus: null, member: null }],
      ['noi tiep khong tham so', P2({ intent: 'NONE' }), memberCtx],
      ['ten o cau hoi so viec', P2({ intent: 'TEAM_WORKLOAD', member: 'Hà', period: 'THIS_WEEK' }), null],
      ['uu tien + tham so thua', P2({ intent: 'MY_PRIORITIES', focus: 'BLOCKED', period: 'TOMORROW' }), null],
      ['chua ho tro', P2({ intent: 'UNSUPPORTED', focus: 'DONE' }), null],
    ];
    for (const [label, parsed, prev] of synthetic) await check(`tiem: ${label}`, 'câu hỏi bất kỳ', prev, parsed);

    expect(mismatches).toEqual([]);
    // chot chong "xanh gia": phep doi chieu da di qua MOI loai ket qua
    expect([...kinds].sort()).toEqual(['ASK_WHO', 'CLARIFY_MEMBER', 'MEMBER_NOT_FOUND', 'QUERY', 'UNSUPPORTED']);
  }, 120_000);
});
