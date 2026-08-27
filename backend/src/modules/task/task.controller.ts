import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import type {
  CreateTaskInput,
  MoveTaskInput,
  TaskQueryInput,
  UpdateTaskInput,
} from './task.schema';
import {
  createTask,
  deleteTask,
  getTaskDetail,
  listProjectTasks,
  moveTask,
  updateTask,
} from './task.service';

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError('Ban chua dang nhap', 401);
  }
  return req.user.id;
}

export const createTaskHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const task = await createTask(
      requireUserId(req),
      req.params.projectId as string,
      req.body as CreateTaskInput
    );
    res.status(201).json({ success: true, message: 'Tao cong viec thanh cong', data: { task } });
  }
);

export const listProjectTasksHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await listProjectTasks(
      requireUserId(req),
      req.params.projectId as string,
      res.locals.query as TaskQueryInput
    );
    res.json({ success: true, data: result });
  }
);

export const getTaskDetailHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const task = await getTaskDetail(requireUserId(req), req.params.taskId as string);
    res.json({ success: true, data: { task } });
  }
);

export const updateTaskHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const task = await updateTask(
      requireUserId(req),
      req.params.taskId as string,
      req.body as UpdateTaskInput
    );
    res.json({ success: true, message: 'Cap nhat cong viec thanh cong', data: { task } });
  }
);

export const moveTaskHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const task = await moveTask(
      requireUserId(req),
      req.params.taskId as string,
      req.body as MoveTaskInput
    );
    res.json({ success: true, message: 'Da di chuyen the', data: { task } });
  }
);

export const deleteTaskHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteTask(requireUserId(req), req.params.taskId as string);
    res.json({ success: true, message: 'Da xoa cong viec' });
  }
);
