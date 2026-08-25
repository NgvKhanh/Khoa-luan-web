import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  addDependency,
  listDependencies,
  removeDependency,
} from './taskDependency.service';
import type { AddDependencyInput } from './taskDependency.schema';

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError('Ban chua dang nhap', 401);
  }
  return req.user.id;
}

export const addDependencyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const dependency = await addDependency(
      requireUserId(req),
      req.params.taskId as string,
      req.body as AddDependencyInput
    );
    res
      .status(201)
      .json({ success: true, message: 'Da them quan he phu thuoc', data: { dependency } });
  }
);

export const listDependenciesHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const dependencies = await listDependencies(
      requireUserId(req),
      req.params.taskId as string
    );
    res.json({ success: true, data: dependencies });
  }
);

export const removeDependencyHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await removeDependency(requireUserId(req), req.params.dependencyId as string);
    res.json({ success: true, message: 'Da xoa quan he phu thuoc' });
  }
);
