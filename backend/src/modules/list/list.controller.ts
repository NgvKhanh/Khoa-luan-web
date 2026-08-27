import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  createList,
  deleteList,
  listProjectLists,
  updateList,
} from './list.service';
import type { CreateListInput, UpdateListInput } from './list.schema';

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError('Ban chua dang nhap', 401);
  }
  return req.user.id;
}

export const listProjectListsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const lists = await listProjectLists(
      requireUserId(req),
      req.params.projectId as string
    );
    res.json({ success: true, data: { lists } });
  }
);

export const createListHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const list = await createList(
      requireUserId(req),
      req.params.projectId as string,
      req.body as CreateListInput
    );
    res
      .status(201)
      .json({ success: true, message: 'Da tao danh sach', data: { list } });
  }
);

export const updateListHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const list = await updateList(
      requireUserId(req),
      req.params.listId as string,
      req.body as UpdateListInput
    );
    res.json({ success: true, message: 'Da cap nhat danh sach', data: { list } });
  }
);

export const deleteListHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteList(requireUserId(req), req.params.listId as string);
    res.json({ success: true, message: 'Da xoa danh sach' });
  }
);
