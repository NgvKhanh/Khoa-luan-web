import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { signToken } from '../../utils/jwt';
import { comparePassword, hashPassword } from '../../utils/password';
import type {
  GoogleAuthInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from './auth.schema';

// Client dung de xac minh chu ky cua ID token do Google phat hanh
const googleClient = new OAuth2Client();

const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  createdAt: true,
} as const;

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

  // Tai khoan tao qua Google chua dat mat khau
  if (!user.passwordHash) {
    throw new AppError(
      'Tai khoan nay dang dang nhap bang Google. Hay bam nut "Dang nhap bang Google".',
      401
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
      createdAt: user.createdAt,
    },
    token,
  };
}

/**
 * Dang nhap / dang ky bang Google.
 * Frontend gui len ID token lay tu Google Identity Services; ta xac minh chu ky
 * va "audience" (dung Client ID cua minh) roi:
 *   1) Tim user theo googleId -> dang nhap
 *   2) Chua co googleId nhung email da ton tai -> lien ket tai khoan cu
 *   3) Chua co gi -> tao tai khoan moi (khong co mat khau)
 */
export async function loginWithGoogle(input: GoogleAuthInput) {
  if (!env.googleClientId) {
    throw new AppError(
      'May chu chua cau hinh GOOGLE_CLIENT_ID nen chua the dang nhap bang Google',
      500
    );
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: input.idToken,
      audience: env.googleClientId,
    });
    payload = ticket.getPayload();
  } catch {
    throw new AppError('Token Google khong hop le hoac da het han', 401);
  }

  if (!payload?.sub || !payload.email) {
    throw new AppError('Khong doc duoc thong tin tai khoan Google', 401);
  }
  if (payload.email_verified === false) {
    throw new AppError('Email Google nay chua duoc xac minh', 401);
  }

  const googleId = payload.sub;
  const email = payload.email.toLowerCase();
  const name = payload.name?.trim() || email.split('@')[0] || 'Nguoi dung';
  const picture = payload.picture ?? null;

  // 1) Da tung dang nhap bang Google
  let user = await prisma.user.findFirst({
    where: { googleId, deletedAt: null },
  });

  // 2) Email da co san -> gan googleId de lien ket
  if (!user) {
    const existingByEmail = await prisma.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (existingByEmail) {
      user = await prisma.user.update({
        where: { id: existingByEmail.id },
        data: {
          googleId,
          avatarUrl: existingByEmail.avatarUrl ?? picture,
        },
      });
    }
  }

  // 3) Tao tai khoan moi
  if (!user) {
    user = await prisma.user.create({
      data: { email, name, googleId, avatarUrl: picture },
    });
  }

  const token = signToken({ userId: user.id });

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
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
