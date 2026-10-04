// Buoc 17 - API ho so tu khai + CV (ASSIGN_MODULE.md §17.8-17.9): luu ho so, tai CV len (trich chu, luu tep RIENG), xoa, tai ve co
// quyen (chu CV / OWNER-ADMIN khong gian chung; con lai 404), gioi han. Test tich hop qua HTTP tren DB THAT + tien trinh con THAT.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CV_DIR, cvDiskPath } from '../src/config/upload';
import { prisma } from '../src/config/prisma';
import { canDownloadCv, uploadMyCv } from '../src/modules/declaredProfile/declaredProfile.service';
import { buildDocx, buildPdf, para } from './fixtures/ai/documents';
import { agent, makeDirectUser, type TestUser } from './helpers';
import { candOf, giveHistory, newTarget, suggest, world } from './assignFixtures';

const ME = '/api/me/assign-profile';
const get = (u: TestUser | null) => (u ? agent().get(ME).set('Cookie', u.cookie) : agent().get(ME));
const put = (u: TestUser | null, body: unknown) => (u ? agent().put(ME).set('Cookie', u.cookie).send(body as object) : agent().put(ME).send(body as object));
const upload = (u: TestUser | null, file: Buffer | null, name = 'cv.docx') => {
  let r = agent().post(`${ME}/cv`);
  if (u) r = r.set('Cookie', u.cookie);
  return file ? r.attach('file', file, name) : r.field('x', 'y');
};
const delCv = (u: TestUser) => agent().delete(`${ME}/cv`).set('Cookie', u.cookie);
const myCv = (u: TestUser) => agent().get(`${ME}/cv`).set('Cookie', u.cookie).buffer(true).parse((res, cb) => {
  const chunks: Buffer[] = [];
  res.on('data', (c: Buffer) => chunks.push(c));
  res.on('end', () => cb(null, Buffer.concat(chunks)));
});
const userCv = (u: TestUser | null, id: string) => {
  const r = agent().get(`/api/users/${id}/assign-profile/cv`);
  return u ? r.set('Cookie', u.cookie) : r;
};
const filesInCv = () => (fs.existsSync(CV_DIR) ? fs.readdirSync(CV_DIR) : []);

// Test tao tep that trong CV_DIR (thu muc TAM cua test - test/uploadsIsolation.ts, khong phai backend/uploads): don cac tep MOI
// sinh ra sau moi test (TRUNCATE chi xoa dong CSDL). Danh sach "tep co san" chup NGAY khi nap tep va sau moi lan don: ban dau de
// rong thi lan don dau tien xoa sach ca tep khong phai cua test (04/10 da mat mot CV that vi loi nay, khi CV_DIR con la thu muc that).
// Tep "cua nguoi khac" dat san TRUOC khi chup: ca cuoi tep kiem no con nguyen (bat dung loi 04/10)
const FOREIGN = 'khong-phai-cua-test.pdf';
fs.mkdirSync(CV_DIR, { recursive: true });
fs.writeFileSync(path.join(CV_DIR, FOREIGN), 'tep co san, test khong duoc xoa');
let before = new Set<string>(filesInCv());
afterEach(() => {
  for (const f of filesInCv()) if (!before.has(f)) fs.rmSync(path.join(CV_DIR, f), { force: true });
  before = new Set(filesInCv());
});
const startTracking = () => {
  before = new Set(filesInCv());
};

const CV_TEXT = 'Kinh nghiem thiet ke giao dien quen mat khau cho ung dung ngan hang ABC';
const cvDocx = () => buildDocx({ body: para(CV_TEXT) });

const VALID = {
  useForAssign: true,
  skillsText: 'React, SQL',
  workItems: [{ title: 'Trang quan tri', description: 'Dashboard' }],
  cvText: null,
};

describe('GET / PUT /api/me/assign-profile', () => {
  it('chua khai -> ho so rong mac dinh (bat "dung cho goi y"); chua dang nhap 401; PUT luu du, cap ma cong viec; lan sau giu ma', async () => {
    const u = await makeDirectUser('A');
    expect((await get(null)).status).toBe(401);
    expect((await get(u)).body.data).toEqual({ useForAssign: true, skillsText: '', workItems: [], cv: null, cvText: null });
    const r = await put(u, VALID);
    expect(r.status).toBe(200);
    const items = r.body.data.workItems as { id: string; title: string; description: string | null }[];
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ title: 'Trang quan tri', description: 'Dashboard' });
    expect(items[0]!.id.length).toBeGreaterThan(8);
    // Gui lai kem ma -> giu nguyen ma; mo ta vang -> null
    const again = await put(u, { ...VALID, workItems: [{ id: items[0]!.id, title: 'Trang quan tri 2' }] });
    expect(again.body.data.workItems).toEqual([{ id: items[0]!.id, title: 'Trang quan tri 2', description: null }]);
    const row = await prisma.userAssignProfile.findUniqueOrThrow({ where: { userId: u.id } });
    expect(row.skillsText).toBe('React, SQL');
    expect((await get(u)).body.data.skillsText).toBe('React, SQL');
  });

  it('gioi han (§17.2) -> 400, khong ghi: ky nang > 2000, > 30 cong viec, ten rong / > 200, mo ta > 1000, CV > 20 000, thieu truong, sai kieu', async () => {
    const u = await makeDirectUser('B');
    const work = (n: number) => Array.from({ length: n }, (_, i) => ({ title: `Viec ${i}` }));
    const bad: [string, unknown][] = [
      ['ky nang dai', { ...VALID, skillsText: 'x'.repeat(2001) }],
      ['31 cong viec', { ...VALID, workItems: work(31) }],
      ['ten rong', { ...VALID, workItems: [{ title: '   ' }] }],
      ['ten dai', { ...VALID, workItems: [{ title: 'x'.repeat(201) }] }],
      ['mo ta dai', { ...VALID, workItems: [{ title: 'a', description: 'x'.repeat(1001) }] }],
      ['CV dai', { ...VALID, cvText: 'x'.repeat(20001) }],
      ['thieu cong tac', { skillsText: '', workItems: [], cvText: null }],
      ['thieu ky nang', { useForAssign: true, workItems: [], cvText: null }],
      ['thieu cong viec', { useForAssign: true, skillsText: '', cvText: null }],
      ['thieu chu CV', { useForAssign: true, skillsText: '', workItems: [] }],
      ['cong tac khong phai boolean', { ...VALID, useForAssign: 'yes' }],
    ];
    for (const [label, body] of bad) expect((await put(u, body)).status, label).toBe(400);
    expect(await prisma.userAssignProfile.count()).toBe(0);
    // Bien van hop le
    expect((await put(u, { ...VALID, skillsText: 'x'.repeat(2000), workItems: work(30), cvText: 'y'.repeat(20000) })).status).toBe(200);
  });

  it('ho so vua luu duoc DUNG trong goi y ngay (khong can tai lai); tat cong tac -> khong dung', async () => {
    const w = await world();
    const target = await newTarget(w.listId);
    await giveHistory(w.listId, w.alice.id);
    await put(w.bob, { ...VALID, skillsText: 'giao dien quen mat khau' });
    const on = await suggest(w.owner, target.id);
    expect(candOf(on.body, w.bob).components.declared.value).toBeGreaterThan(0.5);
    await put(w.bob, { ...VALID, useForAssign: false, skillsText: 'giao dien quen mat khau' });
    const off = await suggest(w.owner, target.id);
    expect(candOf(off.body, w.bob).components.declared.value).toBeNull();
  });
});

describe('POST / DELETE / GET /api/me/assign-profile/cv', () => {
  it('tai .docx: trich chu (tra ve de sua), luu tep RIENG ten ngau nhien, cvText = chu trich; tai lai tep cua minh dung byte', async () => {
    startTracking();
    const u = await makeDirectUser('C');
    const file = await cvDocx();
    const r = await upload(u, file, 'CV Nguyen Van A.docx');
    expect(r.status).toBe(200);
    expect(r.body.data.text).toContain('thiet ke giao dien quen mat khau');
    expect(r.body.data.truncated).toBe(false);
    expect(r.body.data.cv).toMatchObject({ fileName: 'CV Nguyen Van A.docx', size: file.length });
    const row = await prisma.userAssignProfile.findUniqueOrThrow({ where: { userId: u.id } });
    expect(row.cvStoredName).toMatch(/^[0-9a-f-]{36}\.docx$/);
    expect(row.cvText).toContain('ngan hang ABC');
    // Chu CV tra ve cho CHINH chu (de sua): trong ket qua tai len va o GET
    expect(r.body.data.profile.cvText).toBe(row.cvText);
    expect((await get(u)).body.data.cvText).toBe(row.cvText);
    expect(fs.readFileSync(path.join(CV_DIR, row.cvStoredName!)).equals(file)).toBe(true);
    const got = await myCv(u);
    expect(got.status).toBe(200);
    expect(Buffer.compare(got.body as Buffer, file)).toBe(0);
    expect(got.headers['content-disposition']).toMatch(/^attachment; filename\*=UTF-8''CV%20Nguyen%20Van%20A\.docx$/);
    expect(got.headers['content-type']).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    expect(got.headers['x-content-type-options']).toBe('nosniff');
    expect(got.headers['cache-control']).toBe('no-store');
    // Tep KHONG duoc phuc vu tinh o bat ky duong dan /uploads nao (ke ca dang ma hoa)
    for (const url of [`/uploads/cv/${row.cvStoredName}`, `/uploads/%63v/${row.cvStoredName}`, `/uploads/avatars/../cv/${row.cvStoredName}`]) {
      const r2 = await agent().get(url).set('Cookie', u.cookie);
      expect(r2.status, url).toBe(404);
    }
  });

  it('tai .pdf; thay CV -> tep cu bi XOA khoi dia; duoi tep tren dia theo loai DA KIEM (khong lay tu ten nguoi dung)', async () => {
    startTracking();
    const u = await makeDirectUser('D');
    await upload(u, await cvDocx());
    const first = (await prisma.userAssignProfile.findUniqueOrThrow({ where: { userId: u.id } })).cvStoredName!;
    const pdf = buildPdf([[CV_TEXT]]);
    const r = await upload(u, pdf, 'cv.pdf');
    expect(r.status).toBe(200);
    const second = (await prisma.userAssignProfile.findUniqueOrThrow({ where: { userId: u.id } })).cvStoredName!;
    expect(second).toMatch(/\.pdf$/);
    expect(fs.existsSync(path.join(CV_DIR, first))).toBe(false);
    expect(fs.existsSync(path.join(CV_DIR, second))).toBe(true);
    expect((await myCv(u)).headers['content-type']).toContain('application/pdf');
  });

  it('tep hong / gia duoi / sai loai / thieu tep -> 400 va KHONG ghi tep nao, KHONG doi ho so', async () => {
    startTracking();
    const u = await makeDirectUser('E');
    for (const [label, buf, name] of [
      ['chu thuong dat ten .pdf', Buffer.from('xin chao, day khong phai pdf'), 'cv.pdf'],
      ['chu thuong dat ten .docx', Buffer.from('xin chao'), 'cv.docx'],
      ['anh', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]), 'cv.png'],
      ['exe doi ten', Buffer.from('MZ\x90\x00'), 'cv.docx'],
      ['pdf that dat ten .docx', buildPdf([[CV_TEXT]]), 'cv.docx'],
      ['ten goc .pdf.exe', buildPdf([[CV_TEXT]]), 'cv.pdf.exe'],
    ] as [string, Buffer, string][]) {
      expect((await upload(u, buf, name)).status, label).toBe(400);
    }
    expect((await upload(u, null)).status).toBe(400);
    expect((await upload(null, await cvDocx())).status).toBe(401);
    expect(filesInCv().filter((f) => !before.has(f))).toEqual([]);
    expect(await prisma.userAssignProfile.count()).toBe(0);
  });

  it('DELETE: xoa tep tren dia + chu + moi cot cv*; ky nang giu nguyen; chua co CV thi khong loi; GET tep cua minh -> 404', async () => {
    startTracking();
    const u = await makeDirectUser('F');
    await put(u, VALID);
    await upload(u, await cvDocx());
    const stored = (await prisma.userAssignProfile.findUniqueOrThrow({ where: { userId: u.id } })).cvStoredName!;
    const r = await delCv(u);
    expect(r.status).toBe(200);
    expect(r.body.data).toMatchObject({ cv: null, cvText: null, skillsText: 'React, SQL' });
    expect(fs.existsSync(path.join(CV_DIR, stored))).toBe(false);
    const row = await prisma.userAssignProfile.findUniqueOrThrow({ where: { userId: u.id } });
    expect([row.cvText, row.cvFileName, row.cvStoredName, row.cvSize, row.cvUploadedAt]).toEqual([null, null, null, null, null]);
    expect((await delCv(u)).status).toBe(200);
    expect((await myCv(u)).status).toBe(404);
    const nobody = await makeDirectUser('G');
    expect((await delCv(nobody)).status).toBe(200);
    // Chu CV go tay (khong co tep) cung bi xoa; tep da mat tren dia van xoa duoc (200, khong 500)
    await put(u, { ...VALID, cvText: 'Chu CV go tay' });
    expect((await delCv(u)).body.data.cvText).toBeNull();
    await upload(u, await cvDocx());
    const gone = (await prisma.userAssignProfile.findUniqueOrThrow({ where: { userId: u.id } })).cvStoredName!;
    fs.rmSync(path.join(CV_DIR, gone));
    expect((await delCv(u)).status).toBe(200);
    expect((await prisma.userAssignProfile.findUniqueOrThrow({ where: { userId: u.id } })).cvStoredName).toBeNull();
  });

  it('uploadMyCv (goi thang): ten hien thi chi lay PHAN TEN (bo duong dan), toi da 200 ky tu; ten luu tren dia khong phu thuoc ten goc', async () => {
    startTracking();
    const u = await makeDirectUser('H');
    const file = await cvDocx();
    const r = await uploadMyCv(u.id, { buffer: file, originalname: '..\\..\\thu muc\\cv cua toi.docx' });
    expect(r.cv.fileName).toBe('cv cua toi.docx');
    const long = `${'a'.repeat(300)}.docx`;
    const r2 = await uploadMyCv(u.id, { buffer: file, originalname: long });
    expect(r2.cv.fileName).toBe('a'.repeat(200));
    const row = await prisma.userAssignProfile.findUniqueOrThrow({ where: { userId: u.id } });
    expect(row.cvStoredName).toMatch(/^[0-9a-f-]{36}\.docx$/);
    expect(filesInCv().filter((f) => !before.has(f))).toEqual([row.cvStoredName]);
    // Duong dan tren dia luon nam trong CV_DIR (basename chan ../)
    expect(cvDiskPath('../../etc/passwd')).toBe(path.join(CV_DIR, 'passwd'));
  });

  it('ghi CSDL LOI sau khi da ghi tep -> tep moi bi DON (khong de rac)', async () => {
    startTracking();
    // Loi CSDL THAT (khong mock - spyOn tren delegate cua Prisma 7 lam hong cac lan goi sau): nguoi dung khong ton tai -> vi pham
    // khoa ngoai khi tao dong, SAU khi tep da duoc ghi
    await expect(uploadMyCv('khong-ton-tai', { buffer: buildPdf([[CV_TEXT]]), originalname: 'moi.pdf' })).rejects.toThrow();
    expect(filesInCv().filter((f) => !before.has(f))).toEqual([]);
    expect(await prisma.userAssignProfile.count()).toBe(0);
  });

  it('gioi han toc do tai CV: 10 lan / nguoi / 10 phut (ke ca lan loi), lan 11 -> 429; nguoi khac khong bi anh huong', async () => {
    const u = await makeDirectUser('J');
    for (let i = 0; i < 10; i += 1) expect((await upload(u, null)).status, `lan ${i + 1}`).toBe(400);
    expect((await upload(u, null)).status).toBe(429);
    expect((await upload(await makeDirectUser('K'), null)).status).toBe(400);
  });
});

describe('GET /api/users/:userId/assign-profile/cv - quyen tai CV', () => {
  it('chu CV + OWNER/ADMIN khong gian chung: duoc; MEMBER cung khong gian, nguoi ngoai, OWNER khong gian KHAC: 404 (khong lo co CV); chua dang nhap 401', async () => {
    startTracking();
    const owner = await makeDirectUser('Owner');
    const admin = await makeDirectUser('Admin');
    const member = await makeDirectUser('Member');
    const target = await makeDirectUser('Target');
    const outsider = await makeDirectUser('Outsider');
    const otherOwner = await makeDirectUser('OtherOwner');
    await prisma.workspace.create({
      data: {
        ownerId: owner.id,
        name: 'Nhom',
        members: {
          create: [
            { userId: owner.id, role: 'OWNER' },
            { userId: admin.id, role: 'ADMIN' },
            { userId: member.id, role: 'MEMBER' },
            { userId: target.id, role: 'MEMBER' },
          ],
        },
      },
    });
    await prisma.workspace.create({ data: { ownerId: otherOwner.id, name: 'Khac', members: { create: [{ userId: otherOwner.id, role: 'OWNER' }] } } });
    const file = await cvDocx();
    await upload(target, file);

    for (const u of [owner, admin, target]) {
      const r = await userCv(u, target.id).buffer(true);
      expect(r.status, u.name).toBe(200);
      expect(r.headers['content-disposition'], u.name).toMatch(/^attachment;/);
    }
    for (const u of [member, outsider, otherOwner]) {
      const r = await userCv(u, target.id);
      expect(r.status, u.name).toBe(404);
      expect(JSON.stringify(r.body)).not.toContain('ngan hang');
    }
    expect((await userCv(null, target.id)).status).toBe(401);
    // Nguoi KHONG co CV: ca truong nhom cung 404 (giong het "khong co quyen")
    expect((await userCv(owner, member.id)).status).toBe(404);
    expect((await userCv(owner, 'khong-ton-tai')).status).toBe(404);

    // Chu CV TAT "dung cho goi y" -> nguoi khac 404, chinh chu van tai duoc; bat lai -> duoc
    await put(target, { ...VALID, useForAssign: false });
    expect((await userCv(owner, target.id)).status).toBe(404);
    expect((await userCv(admin, target.id)).status).toBe(404);
    expect((await userCv(target, target.id).buffer(true)).status).toBe(200);
    expect((await myCv(target)).status).toBe(200);
    await put(target, VALID);
    expect((await userCv(owner, target.id).buffer(true)).status).toBe(200);

    // Tep mat tren dia -> 404 (khong 500)
    const stored = (await prisma.userAssignProfile.findUniqueOrThrow({ where: { userId: target.id } })).cvStoredName!;
    fs.rmSync(path.join(CV_DIR, stored));
    expect((await userCv(owner, target.id)).status).toBe(404);
    expect((await myCv(target)).status).toBe(404);
  });

  it('canDownloadCv: thanh vien da roi nhom / khong gian da xoa khong con tinh; chu so huu khong gian (khong co dong thanh vien) van tinh', async () => {
    const boss = await makeDirectUser('Boss');
    const t = await makeDirectUser('T');
    const ws = await prisma.workspace.create({ data: { ownerId: t.id, name: 'Cua T', members: { create: [{ userId: boss.id, role: 'ADMIN' }] } }, select: { id: true } });
    expect(await canDownloadCv(boss.id, t.id)).toBe(true); // t la chu so huu khong gian, khong co dong thanh vien
    await prisma.workspaceMember.updateMany({ where: { workspaceId: ws.id, userId: boss.id }, data: { deletedAt: new Date() } });
    expect(await canDownloadCv(boss.id, t.id)).toBe(false);
    await prisma.workspaceMember.updateMany({ where: { workspaceId: ws.id, userId: boss.id }, data: { deletedAt: null } });
    await prisma.workspace.update({ where: { id: ws.id }, data: { deletedAt: null } });
    expect(await canDownloadCv(boss.id, t.id)).toBe(true);
    await prisma.workspace.update({ where: { id: ws.id }, data: { deletedAt: new Date() } });
    expect(await canDownloadCv(boss.id, t.id)).toBe(false);
    expect(await canDownloadCv(t.id, t.id)).toBe(true);
    // Nguoi KHONG co khong gian nao (ke ca khong gian ca nhan) van tai duoc CV cua chinh minh
    const bare = await prisma.user.create({ data: { email: `bare_${Date.now()}@test.local`, name: 'Bare' }, select: { id: true } });
    expect(await canDownloadCv(bare.id, bare.id)).toBe(true);

    // Chu CV la THANH VIEN (khong phai chu so huu) roi nhom -> quan tri vien het quyen
    const lead = await makeDirectUser('Lead');
    const m = await makeDirectUser('M');
    const ws2 = await prisma.workspace.create({
      data: { ownerId: lead.id, name: 'Nhom 2', members: { create: [{ userId: lead.id, role: 'OWNER' }, { userId: m.id, role: 'MEMBER' }] } },
      select: { id: true },
    });
    expect(await canDownloadCv(lead.id, m.id)).toBe(true);
    await prisma.workspaceMember.updateMany({ where: { workspaceId: ws2.id, userId: m.id }, data: { deletedAt: new Date() } });
    expect(await canDownloadCv(lead.id, m.id)).toBe(false);
  });
});

describe('CV di vao bo cham, chu CV khong ra ngoai', () => {
  it('chu trich tu CV (sau khi nguoi dung sua) la mot nguon khop; bang chung muc CV khong co chu', async () => {
    startTracking();
    const w = await world();
    const target = await newTarget(w.listId);
    await giveHistory(w.listId, w.alice.id);
    await upload(w.bob, await cvDocx());
    const res = await suggest(w.owner, target.id);
    const bob = candOf(res.body, w.bob);
    expect(bob.components.declared.value).toBeGreaterThan(0.3);
    expect(bob.declaredEvidence.every((e) => e.kind === 'CV' && e.title === null)).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('ngan hang');
    // Nguoi dung sua chu CV (bo phan lien quan) -> khong con khop
    const cur = (await get(w.bob)).body.data;
    await put(w.bob, { useForAssign: true, skillsText: cur.skillsText, workItems: cur.workItems, cvText: 'So thich: bong da' });
    expect(candOf((await suggest(w.owner, target.id)).body, w.bob).components.declared.value).toBe(0);
  });

  it('cvAvailable trong goi y: chi true khi nguoi HOI tai duoc (chinh minh / quan ly khong gian ma ung vien la thanh vien)', async () => {
    startTracking();
    const w = await world();
    const target = await newTarget(w.listId);
    await upload(w.bob, await cvDocx());
    // bob chi la thanh vien BANG, chua la thanh vien khong gian -> chu khong gian khong quan ly bob
    let res = await suggest(w.owner, target.id);
    expect(candOf(res.body, w.bob).cvAvailable).toBe(false);
    expect(candOf(res.body, w.alice).cvAvailable).toBe(false);
    await prisma.workspaceMember.create({ data: { workspaceId: w.wsId, userId: w.bob.id, role: 'MEMBER' } });
    res = await suggest(w.owner, target.id);
    expect(candOf(res.body, w.bob).cvAvailable).toBe(true);
    expect(candOf(res.body, w.alice).cvAvailable).toBe(false); // khong co CV
    // alice co ho so (khong CV) va la thanh vien khong gian -> van false
    await prisma.workspaceMember.create({ data: { workspaceId: w.wsId, userId: w.alice.id, role: 'MEMBER' } });
    await put(w.alice, VALID);
    expect(candOf((await suggest(w.owner, target.id)).body, w.alice).cvAvailable).toBe(false);
    // Chinh bob hoi: thay CV cua minh; alice (thanh vien thuong) khong thay CV cua bob
    expect(candOf((await suggest(w.bob, target.id)).body, w.bob).cvAvailable).toBe(true);
    expect(candOf((await suggest(w.alice, target.id)).body, w.bob).cvAvailable).toBe(false);
    // bob tat cong tac -> chu khong gian khong con thay
    await put(w.bob, { ...VALID, useForAssign: false });
    expect(candOf((await suggest(w.owner, target.id)).body, w.bob).cvAvailable).toBe(false);
  });
});

describe('don tep cua test khong dung vao tep co san', () => {
  it('tep dat san truoc khi chay (khong do test tao) van con nguyen sau moi ca o tren', () => {
    expect(filesInCv()).toContain(FOREIGN);
    fs.rmSync(path.join(CV_DIR, FOREIGN), { force: true });
  });
});
