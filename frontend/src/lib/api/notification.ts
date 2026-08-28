import { api } from '../axios';
import type { AppNotification } from '../../types/notification';

export async function fetchNotifications(
  unreadOnly: boolean
): Promise<AppNotification[]> {
  const res = await api.get<{ data: { notifications: AppNotification[] } }>(
    '/notifications',
    { params: { unreadOnly: unreadOnly ? 'true' : undefined } }
  );
  return res.data.data.notifications;
}

export async function fetchUnreadCount(): Promise<number> {
  const res = await api.get<{ data: { count: number } }>(
    '/notifications/unread-count'
  );
  return res.data.data.count;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/read-all');
}
