import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  countUnread,
  listNotifications,
  markAllRead,
  markRead,
} from './notification.service';

function uid(req: Request): string {
  if (!req.user) throw new AppError('Ban chua dang nhap', 401);
  return req.user.id;
}

export const listNotificationsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const unreadOnly = req.query.unreadOnly === 'true';
    const notifications = await listNotifications(uid(req), { unreadOnly });
    res.json({ success: true, data: { notifications } });
  }
);

export const unreadCountHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const count = await countUnread(uid(req));
    res.json({ success: true, data: { count } });
  }
);

export const markReadHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await markRead(uid(req), req.params.id as string);
    res.json({ success: true });
  }
);

export const markAllReadHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await markAllRead(uid(req));
    res.json({ success: true });
  }
);
