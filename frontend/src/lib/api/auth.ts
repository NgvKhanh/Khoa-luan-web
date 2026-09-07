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
