import crypto from 'node:crypto';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import type { AuthTokenType } from '../../generated/prisma/enums';

/**
 * Token 1 lan dung cho xac minh email va dat lai mat khau.
 *
 * Nguyen tac: token tho (gui qua email) KHONG bao gio luu vao DB.
 * DB chi luu SHA-256 cua token -> lo DB cung khong the dung token de reset.
 */

const HASH_ALGO = 'sha256';

function hashToken(raw: string): string {
  return crypto.createHash(HASH_ALGO).update(raw).digest('hex');
}

/**
 * Tao token moi cho user. Tra ve chuoi token THO (chua hash) de nhet vao link email.
 * Cac token cu cung loai, chua dung cua user se bi don di.
 */
export async function createAuthToken(
  userId: string,
  type: AuthTokenType,
  ttlMs: number
): Promise<string> {
  const raw = crypto.randomBytes(32).toString('hex'); // 64 ky tu hex
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + ttlMs);

  await prisma.$transaction([
    prisma.authToken.deleteMany({ where: { userId, type, usedAt: null } }),
    prisma.authToken.create({ data: { userId, type, tokenHash, expiresAt } }),
  ]);

  return raw;
}

/**
 * Kiem tra + "tieu thu" token (danh dau da dung). Tra ve userId.
 * Nem AppError neu token sai / het han / da dung.
 */
export async function consumeAuthToken(
  raw: string,
  type: AuthTokenType
): Promise<string> {
  const tokenHash = hashToken(raw);
  const record = await prisma.authToken.findUnique({ where: { tokenHash } });

  if (
    !record ||
    record.type !== type ||
    record.usedAt !== null ||
    record.expiresAt.getTime() < Date.now()
  ) {
    throw new AppError('Lien ket khong hop le hoac da het han', 400);
  }

  await prisma.authToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  return record.userId;
}
