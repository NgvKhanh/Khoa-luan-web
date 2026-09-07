import cookieParser from 'cookie-parser';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env';
import { UPLOAD_ROOT } from './config/upload';
import activityRoutes from './modules/activity/activity.routes';
import authRoutes from './modules/auth/auth.routes';
import boardRoutes from './modules/board/board.routes';
import { boardMemberRoutes } from './modules/board/boardMember.routes';
import {
  attachmentRoutes,
  cardRoutes,
  checklistItemRoutes,
  checklistRoutes,
  commentRoutes,
  listCardRoutes,
} from './modules/card/card.routes';
import { boardListRoutes, listRoutes } from './modules/list/list.routes';
import { boardLabelRoutes, labelRoutes } from './modules/label/label.routes';
import notificationRoutes from './modules/notification/notification.routes';
import unsplashRoutes from './modules/unsplash/unsplash.routes';
import { AppError } from './utils/AppError';

/**
 * Tao va cau hinh Express app.
 * Tach rieng khoi server.ts de sau nay co the dung lai cho viec test.
 */
export function createApp() {
  const app = express();

  // Chi cho phep frontend trong danh sach CORS_ORIGIN goi API
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    })
  );

  // Doc du lieu JSON gui len (gioi han 1mb de tranh request qua lon)
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  // Doc cookie (dung de lay JWT luu trong cookie httpOnly)
  app.use(cookieParser());

  // Route kiem tra server con song hay khong
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'Server dang chay',
      environment: env.nodeEnv,
      timestamp: new Date().toISOString(),
    });
  });

  // Phuc vu file tinh da tai len (anh nen bang...)
  app.use('/uploads', express.static(UPLOAD_ROOT));

  app.use('/api/auth', authRoutes);
  app.use('/api/activities', activityRoutes);
  app.use('/api/boards/:boardId/lists', boardListRoutes);
  app.use('/api/boards/:boardId/members', boardMemberRoutes);
  app.use('/api/boards/:boardId/labels', boardLabelRoutes);
  app.use('/api/boards', boardRoutes);
  app.use('/api/lists/:listId/cards', listCardRoutes);
  app.use('/api/lists', listRoutes);
  app.use('/api/cards', cardRoutes);
  app.use('/api/checklists', checklistRoutes);
  app.use('/api/checklist-items', checklistItemRoutes);
  app.use('/api/attachments', attachmentRoutes);
  app.use('/api/comments', commentRoutes);
  app.use('/api/labels', labelRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/unsplash', unsplashRoutes);

  // Khong khop route nao -> tra ve 404 dang JSON
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      message: `Khong tim thay duong dan: ${req.method} ${req.originalUrl}`,
    });
  });

  // Bat moi loi phat sinh trong app va tra ve dang JSON thong nhat
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ success: false, message: err.message });
      return;
    }

    const message =
      err instanceof Error ? err.message : 'Loi khong xac dinh tu server';

    console.error('[LOI SERVER]', err);

    res.status(500).json({
      success: false,
      message: env.isProduction ? 'Loi he thong, vui long thu lai sau' : message,
    });
  });

  return app;
}
