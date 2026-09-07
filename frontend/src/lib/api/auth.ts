import { api } from '../axios';
import type { User } from '../../types/auth';

export interface MyActivity {
  id: string;
  type: string;
  data: Record<string, string>;
  createdAt: string;
  board: { id: string; name: string } | null;
}

export async function updateProfile(input: {
  name?: string;
  avatarUrl?: string | null;
}): Promise<User> {
  const res = await api.patch<{ data: { user: User } }>('/auth/me', input);
  return res.data.data.user;
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await api.patch('/auth/password', input);
}

// Tai anh dai dien len (field "image", multipart/form-data)
export async function uploadAvatar(file: File): Promise<User> {
  const form = new FormData();
  form.append('image', file);
  const res = await api.post<{ data: { user: User } }>('/auth/me/avatar', form);
  return res.data.data.user;
}

export async function fetchMyActivity(): Promise<MyActivity[]> {
  const res = await api.get<{ data: { activities: MyActivity[] } }>(
    '/activities/me'
  );
  return res.data.data.activities;
}

// Quen mat khau: gui email chua link dat lai.
// previewUrl chi co khi backend chay dev + dung Ethereal (mail ao).
export async function forgotPassword(
  email: string
): Promise<{ previewUrl?: string }> {
  const res = await api.post<{ data?: { previewUrl?: string } }>(
    '/auth/forgot-password',
    { email }
  );
  return res.data.data ?? {};
}

// Dat lai mat khau bang token trong link email.
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<void> {
  await api.post('/auth/reset-password', { token, newPassword });
}

// Xac minh email bang token trong link. Tra ve user da cap nhat.
export async function verifyEmail(token: string): Promise<User> {
  const res = await api.post<{ data: { user: User } }>('/auth/verify-email', {
    token,
  });
  return res.data.data.user;
}

// Gui lai email xac minh (can dang nhap).
export async function resendVerification(): Promise<{ previewUrl?: string }> {
  const res = await api.post<{ data?: { previewUrl?: string } }>(
    '/auth/resend-verification'
  );
  return res.data.data ?? {};
}
