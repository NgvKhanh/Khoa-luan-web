import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import type { CreateBoardInput, UpdateBoardInput } from './board.schema';
import {
  clearBoardBackground,
  createBoard,
  deleteBoard,
  listMyBoards,
  setBoardBackground,
  updateBoard,
} from './board.service';

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError('Ban chua dang nhap', 401);
  }
  return req.user.id;
}

export const listMyBoardsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const boards = await listMyBoards(requireUserId(req));
    res.json({ success: true, data: { boards } });
  }
);

export const createBoardHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const board = await createBoard(
      requireUserId(req),
      req.body as CreateBoardInput
    );
    res
      .status(201)
      .json({ success: true, message: 'Da tao bang', data: { board } });
  }
);

export const updateBoardHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const board = await updateBoard(
      requireUserId(req),
      req.params.boardId as string,
      req.body as UpdateBoardInput
    );
    res.json({ success: true, message: 'Da cap nhat bang', data: { board } });
  }
);

export const uploadBoardBackgroundHandler = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.file) {
      throw new AppError('Chua chon anh de tai len', 400);
    }
    const board = await setBoardBackground(
      requireUserId(req),
      req.params.boardId as string,
      req.file.filename
    );
    res.json({ success: true, message: 'Da cap nhat anh nen', data: { board } });
  }
);

export const deleteBoardBackgroundHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const board = await clearBoardBackground(
      requireUserId(req),
      req.params.boardId as string
    );
    res.json({ success: true, message: 'Da bo anh nen', data: { board } });
  }
);

export const deleteBoardHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteBoard(requireUserId(req), req.params.boardId as string);
    res.json({ success: true, message: 'Da xoa bang' });
  }
);
