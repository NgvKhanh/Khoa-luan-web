// Ho so TU KHAI cua chinh nguoi dung (ky nang, cong viec da lam, CV) - ASSIGN_MODULE.md §17.2, §17.8, §17.9 (buoc 17).
// Mot ho so / nguoi, dung o MOI khong gian. Doc CV = TRICH CHU bang bo trich cua module AI (khong goi LLM); nguoi dung sua chu
// roi luu. Tep CV la du lieu ca nhan nhay cam: thu muc RIENG (khong mount tinh), ten ngau nhien, chi chu CV va OWNER/ADMIN cua
// mot khong gian ma chu CV la thanh vien tai duoc - nguoi khac nhan 404 (khong lo ra la co CV hay khong).

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { cvDiskPath, removeCvFile } from '../../config/upload';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { extractDocument } from '../ai/ai.document';
import { parseWorkItems } from '../assign/assign.repo';
import type { DeclaredProfileInput } from './declaredProfile.schema';

export interface WorkItemView {
  id: string;
  title: string;
  description: string | null;
}

export interface CvInfo {
  fileName: string;
  size: number;
  uploadedAt: Date;
}

export interface DeclaredProfileView {
  useForAssign: boolean;
  skillsText: string;
  workItems: WorkItemView[];
  cv: CvInfo | null;
  /** Chu trich tu CV (nguoi dung da sua) - CHI tra cho chinh chu CV. */
  cvText: string | null;
}

const EMPTY: DeclaredProfileView = { useForAssign: true, skillsText: '', workItems: [], cv: null, cvText: null };

type Row = NonNullable<Awaited<ReturnType<typeof readRow>>>;

function readRow(userId: string) {
  return prisma.userAssignProfile.findUnique({ where: { userId } });
}

/** workItems (JSON) co ma muc: muc cu khong co ma -> tao ma tat dinh theo vi tri de giao dien co khoa on dinh. */
function workItemsOf(json: unknown): WorkItemView[] {
  const raw = Array.isArray(json) ? json : [];
  return parseWorkItems(json).map((w, i) => {
    const id = (raw[i] as { id?: unknown } | undefined)?.id;
    return { id: typeof id === 'string' && id !== '' ? id : `muc-${i + 1}`, title: w.title, description: w.description ?? null };
  });
}

function viewOf(row: Row | null): DeclaredProfileView {
  if (!row) return { ...EMPTY };
  return {
    useForAssign: row.useForAssign,
    skillsText: row.skillsText,
    workItems: workItemsOf(row.workItems),
    cv:
      row.cvStoredName && row.cvFileName && row.cvSize !== null && row.cvUploadedAt
        ? { fileName: row.cvFileName, size: row.cvSize, uploadedAt: row.cvUploadedAt }
        : null,
    cvText: row.cvText,
  };
}

export async function getMyDeclaredProfile(userId: string): Promise<DeclaredProfileView> {
  return viewOf(await readRow(userId));
}

/** Luu phan TU DIEN (cong tac, ky nang, cong viec, chu CV da sua). Tep CV di qua uploadMyCv / deleteMyCv. */
export async function saveMyDeclaredProfile(userId: string, input: DeclaredProfileInput): Promise<DeclaredProfileView> {
  const workItems = input.workItems.map((w) => ({
    id: w.id ?? crypto.randomUUID(),
    title: w.title,
    description: w.description ?? null,
  }));
  const data = { useForAssign: input.useForAssign, skillsText: input.skillsText, workItems, cvText: input.cvText };
  const row = await prisma.userAssignProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
  return viewOf(row);
}

export interface CvUploadResult {
  cv: CvInfo;
  /** Chu trich duoc - giao dien cho nguoi dung SUA roi luu (PUT) lai. */
  text: string;
  truncated: boolean;
  profile: DeclaredProfileView;
}

/** Ten tep hien thi: chi phan ten (khong duong dan), toi da 200 ky tu. Khong dung de ghi dia (ten tren dia la UUID). */
function displayName(original: string): string {
  const base = path.basename(original.replace(/\\/g, '/')).trim();
  return (base === '' ? 'cv' : base).slice(0, 200);
}

/**
 * Nhan tep CV (.pdf / .docx, <= 5MB, da qua multer trong bo nho): TRICH CHU truoc (kiem magic bytes, zip bomb, tien trinh con co gioi
 * han) - chi khi doc duoc moi ghi tep xuong thu muc rieng. Duoi tep tren dia lay tu LOAI THAT cua noi dung, khong tu ten nguoi dung.
 * Thay CV cu: xoa tep cu SAU khi da luu dong moi.
 */
export async function uploadMyCv(userId: string, file: { buffer: Buffer; originalname: string } | undefined): Promise<CvUploadResult> {
  if (!file) throw new AppError('Thiếu tệp CV (trường "file")', 400);
  const extracted = await extractDocument(file.buffer, file.originalname);
  const storedName = `${crypto.randomUUID()}${extracted.inputKind === 'PDF' ? '.pdf' : '.docx'}`;
  await fs.promises.writeFile(cvDiskPath(storedName), file.buffer);
  const previous = (await readRow(userId))?.cvStoredName ?? null;
  const cv = { cvFileName: displayName(file.originalname), cvStoredName: storedName, cvSize: file.buffer.length, cvUploadedAt: new Date() };
  let row: Row;
  try {
    row = await prisma.userAssignProfile.upsert({
      where: { userId },
      create: { userId, ...cv, cvText: extracted.text },
      update: { ...cv, cvText: extracted.text },
    });
  } catch (err) {
    await removeCvFile(storedName);
    throw err;
  }
  if (previous && previous !== storedName) await removeCvFile(previous);
  const profile = viewOf(row);
  return { cv: profile.cv!, text: extracted.text, truncated: extracted.truncated, profile };
}

/** Xoa CV: tep tren dia + chu trich + moi cot cv*. Chua co CV -> khong lam gi. */
export async function deleteMyCv(userId: string): Promise<DeclaredProfileView> {
  const row = await readRow(userId);
  if (!row || (!row.cvStoredName && row.cvText === null)) return viewOf(row);
  const updated = await prisma.userAssignProfile.update({
    where: { userId },
    data: { cvText: null, cvFileName: null, cvStoredName: null, cvSize: null, cvUploadedAt: null },
  });
  await removeCvFile(row.cvStoredName);
  return viewOf(updated);
}

/**
 * Nhung nguoi trong `userIds` ma `requesterId` QUAN LY: la thanh vien (chua roi) hoac chu so huu cua mot khong gian CHUA XOA ma
 * requester la OWNER / ADMIN. Nguon DUY NHAT cua quyen tai CV nguoi khac (tai tung nguoi va co `cvAvailable` trong goi y).
 */
async function managedAmong(requesterId: string, userIds: readonly string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (userIds.length === 0) return out;
  const wanted = new Set(userIds);
  const rows = await prisma.workspaceMember.findMany({
    where: { userId: requesterId, deletedAt: null, role: { in: ['OWNER', 'ADMIN'] }, workspace: { deletedAt: null } },
    select: {
      workspace: {
        select: { ownerId: true, members: { where: { userId: { in: [...wanted] }, deletedAt: null }, select: { userId: true } } },
      },
    },
  });
  for (const { workspace } of rows) {
    if (wanted.has(workspace.ownerId)) out.add(workspace.ownerId);
    for (const m of workspace.members) out.add(m.userId);
  }
  return out;
}

/** Quyen tai CV cua `targetId` (chua xet co tep hay khong): chinh chu CV, hoac nguoi quan ly chu CV (managedAmong). */
export async function canDownloadCv(requesterId: string, targetId: string): Promise<boolean> {
  if (requesterId === targetId) return true;
  return (await managedAmong(requesterId, [targetId])).has(targetId);
}

export interface CvFile {
  diskPath: string;
  fileName: string;
  storedName: string;
}

/**
 * Tep CV de tai ve. Nguoi KHAC chi tai duoc khi chu CV dang BAT "dung cho goi y" (tat = rut CV khoi moi nguoi, chu CV van tai duoc).
 * Khong co quyen / khong co CV / da tat / tep mat -> CUNG 404 (khong lo thong tin).
 */
export async function cvFileFor(requesterId: string, targetId: string): Promise<CvFile> {
  const notFound = new AppError('Không tìm thấy CV', 404);
  if (!(await canDownloadCv(requesterId, targetId))) throw notFound;
  const row = await readRow(targetId);
  if (!row?.cvStoredName || !row.cvFileName) throw notFound;
  if (requesterId !== targetId && !row.useForAssign) throw notFound;
  const diskPath = cvDiskPath(row.cvStoredName);
  if (!fs.existsSync(diskPath)) throw notFound;
  return { diskPath, fileName: row.cvFileName, storedName: row.cvStoredName };
}

/** Trong `userIds`, nhung nguoi ma `requesterId` tai duoc CV (co tep + co quyen, cung luat voi cvFileFor tru buoc kiem tep tren dia). */
export async function cvDownloadableOf(requesterId: string, userIds: readonly string[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (userIds.length === 0) return out;
  const rows = await prisma.userAssignProfile.findMany({
    where: { userId: { in: [...userIds] }, cvStoredName: { not: null }, cvFileName: { not: null } },
    select: { userId: true, useForAssign: true },
  });
  const others: string[] = [];
  for (const r of rows) {
    if (r.userId === requesterId) out.add(r.userId);
    else if (r.useForAssign) others.push(r.userId);
  }
  for (const id of await managedAmong(requesterId, others)) out.add(id);
  return out;
}
