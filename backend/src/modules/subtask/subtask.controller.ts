import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  createSubtask,
  deleteSubtask,
  listSubtasks,
  updateSubtask,
} from './subtask.service';
import type { CreateSubtaskInput, UpdateSubtaskInput } from './subtask.schema';

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError('Ban chua dang nhap', 401);
  }
  return req.user.id;
}

export const createSubtaskHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const subtask = await createSubtask(
      requireUserId(req),
      req.params.taskId as string,
      req.body as CreateSubtaskInput
    );
    res.status(201).json({ success: true, message: 'Da tao cong viec con', data: { subtask } });
  }
);

export const listSubtasksHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const subtasks = await listSubtasks(
      requireUserId(req),
      req.params.taskId as string
    );
    res.json({ success: true, data: { subtasks } });
  }
);

export const updateSubtaskHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const subtask = await updateSubtask(
      requireUserId(req),
      req.params.subtaskId as string,
      req.body as UpdateSubtaskInput
    );
    res.json({ success: true, message: 'Da cap nhat cong viec con', data: { subtask } });
  }
);

export const deleteSubtaskHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteSubtask(requireUserId(req), req.params.subtaskId as string);
    res.json({ success: true, message: 'Da xoa cong viec con' });
  }
);
