import { env } from '../../config/env';
import { sendMail } from '../../config/mailer';
import { prisma } from '../../config/prisma';
import { avatarPublicPath, removeAvatarFile } from '../../config/upload';
import { AppError } from '../../utils/AppError';
import { signToken } from '../../utils/jwt';
import { comparePassword, hashPassword } from '../../utils/password';
import { consumeAuthToken, createAuthToken } from './authToken.service';
import { resetPasswordEmail, verifyEmailEmail } from './emailTemplates';
import type {
  ChangePasswordInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  UpdateProfileInput,
  VerifyEmailInput,
} from './auth.schema';

const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 gio
const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000; // 24 gio

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  emailVerifiedAt: true,
  createdAt: true,
} as const;

/**
 * Tao token EMAIL_VERIFY va gui mail xac minh cho user.
 * Loi gui mail duoc nuot (chi log) de khong lam hong luong dang ky.
 * Tra ve previewUrl (link mail Ethereal) khi chay dev.
 */
async function sendVerificationEmail(user: {
  id: string;
  name: string;
  email: string;
}): Promise<{ previewUrl: string | null }> {
  try {
    const rawToken = await createAuthToken(
      user.id,
      'EMAIL_VERIFY',
      EMAIL_VERIFY_TTL_MS
    );
    const url = `${env.frontendUrl}/verify-email?token=${rawToken}`;
    const { subject, html } = verifyEmailEmail({
      name: user.name,
      url,
      expiresInHours: EMAIL_VERIFY_TTL_MS / 3600000,
    });
    const { previewUrl } = await sendMail({ to: user.email, subject, html });
    return { previewUrl: env.isProduction ? null : previewUrl };
  } catch (err) {
    console.error('[auth] Gui mail xac minh that bai:', err);
    return { previewUrl: null };
  }
}

export async function registerUser(input: RegisterInput) {
  const existing = await prisma.user.findFirst({
    where: { email: input.email, deletedAt: null },
    select: { id: true },
  });

  if (existing) {
    throw new AppError('Email nay da duoc su dung', 409);
  }

  const passwordHash = await hashPassword(input.password);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
    },
    select: PUBLIC_USER_SELECT,
  });

  // Gui mail xac minh (khong chan neu that bai)
  await sendVerificationEmail(user);

  const token = signToken({ userId: user.id });

  return { user, token };
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findFirst({
    where: { email: input.email, deletedAt: null },
  });

  if (!user) {
    throw new AppError('Email hoac mat khau khong dung', 401);
  }

  if (!user.passwordHash) {
    throw new AppError(
      'Tai khoan nay dang nhap bang Google. Hay dung nut "Dang nhap voi Google".',
      400
    );
  }

  const isPasswordValid = await comparePassword(
    input.password,
    user.passwordHash
  );

  if (!isPasswordValid) {
    throw new AppError('Email hoac mat khau khong dung', 401);
  }

  const token = signToken({ userId: user.id });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      emailVerifiedAt: user.emailVerifiedAt,
      createdAt: user.createdAt,
    },
    token,
  };
}

export async function getUserProfile(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: PUBLIC_USER_SELECT,
  });

  if (!user) {
    throw new AppError('Khong tim thay nguoi dung', 404);
  }

  return user;
}

export async function updateUserProfile(
  userId: string,
  input: UpdateProfileInput
) {
  if (Object.keys(input).length === 0) {
    throw new AppError('Khong co du lieu nao de cap nhat', 400);
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
    },
    select: PUBLIC_USER_SELECT,
  });

  return user;
}

// Tai anh dai dien len: luu file, cap nhat avatarUrl, xoa anh cu (neu la file upload)
export async function setUserAvatar(userId: string, filename: string) {
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });

  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: avatarPublicPath(filename) },
    select: PUBLIC_USER_SELECT,
  });

  removeAvatarFile(current?.avatarUrl ?? null);
  return user;
}

export async function changeUserPassword(
  userId: string,
  input: ChangePasswordInput
) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });
  if (!user) {
    throw new AppError('Khong tim thay nguoi dung', 404);
  }

  if (!user.passwordHash) {
    throw new AppError(
      'Tai khoan Google chua co mat khau. Hay dung chuc nang "Quen mat khau" de dat mat khau moi.',
      400
    );
  }

  const ok = await comparePassword(input.currentPassword, user.passwordHash);
  if (!ok) {
    throw new AppError('Mat khau hien tai khong dung', 400);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });
}

/**
 * Quen mat khau: neu email ton tai (va la tai khoan co mat khau) thi gui mail
 * chua link dat lai. Ham nay KHONG bao gio bao "email khong ton tai" -> tranh
 * lo danh sach email da dang ky. Controller luon tra ve cung mot thong bao.
 *
 * Tra ve previewUrl (link xem mail Ethereal) khi chay dev, de tien kiem thu.
 */
export async function requestPasswordReset(
  input: ForgotPasswordInput
): Promise<{ previewUrl: string | null }> {
  const user = await prisma.user.findFirst({
    where: { email: input.email, deletedAt: null },
    select: { id: true, name: true, email: true, passwordHash: true },
  });

  // Khong co user, hoac tai khoan chi dang nhap Google -> im lang bo qua
  if (!user) {
    return { previewUrl: null };
  }

  const rawToken = await createAuthToken(
    user.id,
    'PASSWORD_RESET',
    PASSWORD_RESET_TTL_MS
  );
  const url = `${env.frontendUrl}/reset-password?token=${rawToken}`;

  try {
    const { subject, html } = resetPasswordEmail({
      name: user.name,
      url,
      expiresInMinutes: PASSWORD_RESET_TTL_MS / 60000,
    });
    const { previewUrl } = await sendMail({ to: user.email, subject, html });
    return { previewUrl: env.isProduction ? null : previewUrl };
  } catch (err) {
    console.error('[auth] Gui mail dat lai mat khau that bai:', err);
    return { previewUrl: null };
  }
}

/**
 * Dat lai mat khau bang token trong link email.
 * Token hop le -> doi mat khau, danh dau token da dung, coi email da xac minh.
 */
export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const userId = await consumeAuthToken(input.token, 'PASSWORD_RESET');

  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await hashPassword(input.newPassword),
      // Dat lai mat khau qua email cung chung minh so huu email
      emailVerifiedAt: new Date(),
    },
  });
}

/**
 * Xac minh email bang token trong link. Tra ve thong tin user da cap nhat.
 * Neu email da xac minh tu truoc thi giu nguyen moc thoi gian cu.
 */
export async function verifyEmail(input: VerifyEmailInput) {
  const userId = await consumeAuthToken(input.token, 'EMAIL_VERIFY');

  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { emailVerifiedAt: true },
  });

  const user = await prisma.user.update({
    where: { id: userId },
    data: { emailVerifiedAt: current?.emailVerifiedAt ?? new Date() },
    select: PUBLIC_USER_SELECT,
  });

  return user;
}

/**
 * Gui lai email xac minh cho nguoi dung dang dang nhap.
 * Da xac minh roi -> bao loi 400.
 */
export async function resendVerification(
  userId: string
): Promise<{ previewUrl: string | null }> {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    select: { id: true, name: true, email: true, emailVerifiedAt: true },
  });

  if (!user) {
    throw new AppError('Khong tim thay nguoi dung', 404);
  }
  if (user.emailVerifiedAt) {
    throw new AppError('Email cua ban da duoc xac minh', 400);
  }

  return sendVerificationEmail(user);
}
