import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  createComment,
  deleteComment,
  listComments,
  updateComment,
} from './comment.service';
import type { CreateCommentInput, UpdateCommentInput } from './comment.schema';

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError('Ban chua dang nhap', 401);
  }
  return req.user.id;
}

export const createCommentHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const comment = await createComment(
      requireUserId(req),
      req.params.taskId as string,
      req.body as CreateCommentInput
    );
    res.status(201).json({ success: true, message: 'Da them binh luan', data: { comment } });
  }
);

export const listCommentsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const comments = await listComments(
      requireUserId(req),
      req.params.taskId as string
    );
    res.json({ success: true, data: { comments } });
  }
);

export const updateCommentHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const comment = await updateComment(
      requireUserId(req),
      req.params.commentId as string,
      req.body as UpdateCommentInput
    );
    res.json({ success: true, message: 'Da cap nhat binh luan', data: { comment } });
  }
);

export const deleteCommentHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteComment(requireUserId(req), req.params.commentId as string);
    res.json({ success: true, message: 'Da xoa binh luan' });
  }
);
