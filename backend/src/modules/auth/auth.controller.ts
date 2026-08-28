import type { CookieOptions, Request, Response } from 'express';
import { env } from '../../config/env';
import { TOKEN_COOKIE_NAME } from '../../middleware/auth.middleware';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  getUserProfile,
  loginUser,
  loginWithGoogle,
  registerUser,
  updateUserProfile,
} from './auth.service';
import type {
  GoogleAuthInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
} from './auth.schema';

const TOKEN_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 ngay

function tokenCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
    maxAge: TOKEN_COOKIE_MAX_AGE_MS,
  };
}

// Khi xoa cookie khong duoc truyen maxAge (Express 5 canh bao deprecated)
function clearTokenCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: 'lax',
  };
}

export const register = asyncHandler(async (req: Request, res: Response) => {
  const { user, token } = await registerUser(req.body as RegisterInput);

  res.cookie(TOKEN_COOKIE_NAME, token, tokenCookieOptions());
  res.status(201).json({
    success: true,
    message: 'Dang ky thanh cong',
    data: { user, token },
  });
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { user, token } = await loginUser(req.body as LoginInput);

  res.cookie(TOKEN_COOKIE_NAME, token, tokenCookieOptions());
  res.json({
    success: true,
    message: 'Dang nhap thanh cong',
    data: { user, token },
  });
});

export const googleAuth = asyncHandler(async (req: Request, res: Response) => {
  const { user, token } = await loginWithGoogle(req.body as GoogleAuthInput);

  res.cookie(TOKEN_COOKIE_NAME, token, tokenCookieOptions());
  res.json({
    success: true,
    message: 'Dang nhap bang Google thanh cong',
    data: { user, token },
  });
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.clearCookie(TOKEN_COOKIE_NAME, clearTokenCookieOptions());
  res.json({ success: true, message: 'Da dang xuat' });
});

export const getMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Ban chua dang nhap', 401);
  }

  const user = await getUserProfile(req.user.id);
  res.json({ success: true, data: { user } });
});

export const updateMe = asyncHandler(async (req: Request, res: Response) => {
  if (!req.user) {
    throw new AppError('Ban chua dang nhap', 401);
  }

  const user = await updateUserProfile(
    req.user.id,
    req.body as UpdateProfileInput
  );

  res.json({
    success: true,
    message: 'Cap nhat thong tin thanh cong',
    data: { user },
  });
});
