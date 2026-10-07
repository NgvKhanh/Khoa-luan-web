// Run from backend: node -r tsx/cjs test/browserChatV2.cjs [--live]
// Needs Playwright (or TASKFLOW_PLAYWRIGHT_MODULE pointing to an installed module).
// Isolated local TEST DB and ports 4200/5175; does not access the running app's data.
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { parse } = require('dotenv');
const ai = parse(readFileSync('.env', 'utf8'));
require('./dbSafety.ts').loadAndAssertTestDatabaseUrl();
for (const key of ['AI_BASE_URL', 'AI_API_KEY', 'AI_MODEL']) process.env[key] = process.argv.includes('--live') ? ai[key] ?? '' : '';
process.env.CORS_ORIGIN = 'http://127.0.0.1:5175';
process.env.CHAT_ENGINE = 'v2';
const { prisma } = require('../src/config/prisma.ts');
const { createApp } = require('../src/app.ts');
const { signToken } = require('../src/utils/jwt.ts');
const { seedChatV2 } = require('./chat.v2.fixture.ts');
const { v2Sessions } = require('../src/modules/chat/v2/chat.v2.session.ts');
const { chromium } = require(process.env.TASKFLOW_PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  let server, vite, browser;
  try {
    let numeric = await prisma.board.findUnique({ where: { id: '1234' } });
    if (!numeric) { await seedChatV2(); numeric = await prisma.board.findUniqueOrThrow({ where: { id: '1234' } }); }
    const user = await prisma.user.findUniqueOrThrow({ where: { id: numeric.ownerId } });
    server = createApp().listen(4200, '127.0.0.1');
    await once(server, 'listening');
    vite = spawn(process.execPath, [resolve('../frontend/node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', '5175', '--strictPort'], {
      cwd: resolve('../frontend'), env: { ...process.env, VITE_API_URL: 'http://127.0.0.1:4200/api' }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    await new Promise((ok, fail) => {
      const timer = setTimeout(() => fail(new Error('Vite did not start')), 15_000);
      vite.stdout.on('data', (chunk) => { if (String(chunk).includes('5175')) { clearTimeout(timer); ok(); } });
      vite.once('exit', () => { clearTimeout(timer); fail(new Error('Vite exited')); });
    });
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    await context.addCookies([{ name: 'token', value: signToken({ userId: user.id, tokenVersion: user.tokenVersion }), domain: '127.0.0.1', path: '/', httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage();
    page.on('response', async (res) => {
      if (!res.url().endsWith('/chat/v2/messages') || res.status() !== 200) return;
      const body = await res.json().catch(() => null);
      if (!body) return; // The page can close while the final response logger is reading.
      const reply = body.data;
      console.log(JSON.stringify({ phase: 'message', mode: reply.mode, kind: reply.answer.kind, blocks: reply.answer.blocks?.map((b) => b.status === 'OK' ? { tool: b.tool, title: b.title, total: b.data.total, input: b.source.appliedInput } : { status: b.status }) }));
    });
    const browserErrors = [];
    page.on('pageerror', () => browserErrors.push('PAGE_ERROR'));
    await page.goto('http://127.0.0.1:5175/boards');
    await page.getByRole('button', { name: 'Trợ lý', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'Trợ lý công việc' });
    await page.waitForFunction(() => !document.querySelector('aside[aria-label="Trợ lý công việc"]')?.textContent.includes('Đang tải lịch sử trò chuyện'));
    const fresh = panel.getByRole('button', { name: 'Hội thoại mới' });
    if (await fresh.isEnabled()) await fresh.click();
    if (await panel.getByRole('radio').count()) throw new Error('Scope picker still visible');
    async function ask(question) {
      await panel.getByRole('textbox', { name: 'Câu hỏi cho trợ lý' }).fill(question);
      await panel.getByRole('button', { name: 'Gửi', exact: true }).click();
    }
    await ask('trong bảng 1234 những công việc nào đã được gán thành viên và những công việc nào chưa được gán.');
    const assigned = panel.getByRole('region', { name: 'Công việc đã được phân công' }).last();
    const unassigned = panel.getByRole('region', { name: 'Công việc chưa được phân công' }).last();
    await assigned.waitFor({ timeout: 40_000 }); await unassigned.waitFor({ timeout: 40_000 });
    if (!await assigned.getByText('Tổng: 6 công việc', { exact: true }).count()) throw new Error('Assigned total');
    if (!await unassigned.getByText('Tổng: 25 công việc', { exact: true }).count()) throw new Error('Unassigned total');
    // Lose server memory and reload the UI: both transcript and query context come from DB.
    v2Sessions.get(user.id, undefined, new Date(Date.now() + 31 * 60_000));
    await page.reload();
    await page.getByRole('button', { name: 'Trợ lý', exact: true }).click();
    await assigned.waitFor({ timeout: 15_000 });
    if (await unassigned.locator('a[href*="?card="]').count() !== 20) throw new Error('Reload did not restore transcript');
    const moreResponse = page.waitForResponse((r) => r.url().endsWith('/chat/v2/messages/more') && r.request().method() === 'POST');
    await unassigned.getByRole('button', { name: /Xem thêm/ }).click();
    const more = await moreResponse;
    if (more.status() !== 200) throw new Error('More failed');
    await page.waitForFunction(() => document.querySelector('section[aria-label="Công việc chưa được phân công"]')?.querySelectorAll('a[href*="?card="]').length === 25);
    if (await assigned.locator('a[href*="?card="]').count() !== 6) throw new Error('Changed unrelated block');
    const cardLink = unassigned.locator('a[href*="?card="]').first();
    await cardLink.click(); await page.waitForURL(/\?card=/);
    await page.getByRole('button', { name: 'Đóng', exact: true }).click();
    await panel.getByRole('button', { name: 'Hội thoại mới' }).click();
    await ask('Trong bảng 1234 ai đang có số lượng công việc lớn hơn và những công việc nào chưa được chia cho các thành viên?');
    const stats = panel.getByRole('region', { name: 'Thống kê công việc' }).last();
    await stats.waitFor({ timeout: 40_000 });
    if (!(await stats.textContent()).includes('đồng hạng')) throw new Error('Missing ties');
    await panel.evaluate((el) => { const scroller = el.querySelector('.overflow-y-auto'); if (scroller) scroller.scrollTop = 0; });
    await page.screenshot({ path: 'chat-v2-browser.png', fullPage: true });
    await panel.getByRole('button', { name: 'Hội thoại mới' }).click();
    await ask('bảng 1234 gồm những ai');
    const members = panel.getByRole('region', { name: 'Danh sách thành viên' }).last();
    await members.waitFor({ timeout: 40_000 });
    if (await members.getByRole('listitem').count() !== 4) throw new Error('Wrong member count');
    for (const name of ['Chủ nhóm', 'Nguyễn Lan', 'Trần Tuấn', 'Không Việc']) {
      if (!await members.getByText(name, { exact: true }).count()) throw new Error('Missing member');
    }
    await panel.getByRole('button', { name: 'Lịch sử trò chuyện', exact: true }).click();
    await panel.getByRole('button', { name: /^trong bảng 1234 những công việc nào đã được gán thành viên/ }).click();
    await unassigned.waitFor({ timeout: 15_000 });
    if (await unassigned.locator('a[href*="?card="]').count() !== 25) throw new Error('History did not retain loaded pages');
    await ask('những việc nào chưa được gán?');
    await page.waitForFunction(() => document.querySelectorAll('section[aria-label="Công việc chưa được phân công"]').length === 2);
    if (browserErrors.length) throw new Error('Browser runtime error');
    console.log(JSON.stringify({ passed: true, liveProvider: process.argv.includes('--live'), assigned: 6, unassigned: 25, independentPagination: true, cardNavigation: true, tiedWorkload: true, boardMembers: 4, restoredAfterReload: true, restoredServerContext: true, openedOlderConversation: true, screenshot: 'chat-v2-browser.png' }));
  } finally {
    await browser?.close(); vite?.kill();
    if (server) await new Promise((ok) => server.close(ok));
    await prisma.$disconnect();
  }
}
void main().catch((e) => { console.error('Browser smoke failed: ' + String(e.message).split(ai.AI_API_KEY || 'not-a-key').join('***').slice(0, 700)); process.exitCode = 1; });
