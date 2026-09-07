import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import type {
  CreateCardInput,
  MoveCardInput,
  UpdateCardInput,
} from './card.schema';
import {
  archiveCard,
  createCard,
  deleteCard,
  moveCard,
  purgeCard,
  restoreCard,
  updateCard,
} from './card.service';

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError('Ban chua dang nhap', 401);
  }
  return req.user.id;
}

export const createCardHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const card = await createCard(
      requireUserId(req),
      req.params.listId as string,
      req.body as CreateCardInput
    );
    res
      .status(201)
      .json({ success: true, message: 'Da them the', data: { card } });
  }
);

export const updateCardHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const card = await updateCard(
      requireUserId(req),
      req.params.cardId as string,
      req.body as UpdateCardInput
    );
    res.json({ success: true, message: 'Da cap nhat the', data: { card } });
  }
);

export const moveCardHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const card = await moveCard(
      requireUserId(req),
      req.params.cardId as string,
      req.body as MoveCardInput
    );
    res.json({ success: true, message: 'Da di chuyen the', data: { card } });
  }
);

export const deleteCardHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteCard(requireUserId(req), req.params.cardId as string);
    res.json({ success: true, message: 'Da xoa the' });
  }
);

export const archiveCardHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await archiveCard(requireUserId(req), req.params.cardId as string);
    res.json({ success: true, message: 'Da luu tru the' });
  }
);

export const restoreCardHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await restoreCard(requireUserId(req), req.params.cardId as string);
    res.json({ success: true, message: 'Da khoi phuc the' });
  }
);

export const purgeCardHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await purgeCard(requireUserId(req), req.params.cardId as string);
    res.json({ success: true, message: 'Da xoa han the' });
  }
);
