import cookieParser from 'cookie-parser';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { env } from './config/env';
import authRoutes from './modules/auth/auth.routes';
import { commentRoutes, taskCommentRoutes } from './modules/comment/comment.routes';
import { listRoutes, projectListRoutes } from './modules/list/list.routes';
import projectRoutes from './modules/project/project.routes';
import { subtaskRoutes, taskSubtaskRoutes } from './modules/subtask/subtask.routes';
import {
  dependencyRoutes,
  taskDependencyRoutes,
} from './modules/task-dependency/taskDependency.routes';
import { projectTaskRoutes, taskRoutes } from './modules/task/task.routes';
import teamRoutes from './modules/team/team.routes';
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

  app.use('/api/auth', authRoutes);
  app.use('/api/teams', teamRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/projects/:projectId/tasks', projectTaskRoutes);
  app.use('/api/projects/:projectId/lists', projectListRoutes);
  app.use('/api/lists', listRoutes);
  app.use('/api/tasks/:taskId/subtasks', taskSubtaskRoutes);
  app.use('/api/tasks/:taskId/dependencies', taskDependencyRoutes);
  app.use('/api/tasks/:taskId/comments', taskCommentRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/subtasks', subtaskRoutes);
  app.use('/api/dependencies', dependencyRoutes);
  app.use('/api/comments', commentRoutes);

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
