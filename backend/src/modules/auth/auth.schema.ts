import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Ho ten phai co it nhat 2 ky tu')
    .max(100, 'Ho ten qua dai'),
  email: z.string().trim().toLowerCase().email('Email khong hop le'),
  password: z
    .string()
    .min(6, 'Mat khau phai co it nhat 6 ky tu')
    .max(72, 'Mat khau qua dai'),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email khong hop le'),
  password: z.string().min(1, 'Vui long nhap mat khau'),
});

// ID token nhan tu Google Identity Services o phia frontend
export const googleAuthSchema = z.object({
  idToken: z.string().min(10, 'Thieu ID token cua Google'),
});

export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Ho ten phai co it nhat 2 ky tu')
    .max(100, 'Ho ten qua dai')
    .optional(),
  avatarUrl: z
    .union([z.string().trim().url('Duong dan anh dai dien khong hop le'), z.null()])
    .optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
