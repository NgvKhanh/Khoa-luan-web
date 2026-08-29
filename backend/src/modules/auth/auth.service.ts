import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { signToken } from '../../utils/jwt';
import { comparePassword, hashPassword } from '../../utils/password';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from './auth.schema';

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

  const ok = await comparePassword(input.currentPassword, user.passwordHash);
  if (!ok) {
    throw new AppError('Mat khau hien tai khong dung', 400);
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });
}
