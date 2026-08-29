import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  attachLabel,
  detachLabel,
} from '../label/label.service';
import { getCardDetail } from './card.service';
import {
  addCardMember,
  addChecklist,
  addChecklistItem,
  addComment,
  deleteChecklist,
  deleteChecklistItem,
  deleteComment,
  removeCardMember,
  updateChecklist,
  updateChecklistItem,
  updateComment,
} from './cardExtras.service';

function uid(req: Request): string {
  if (!req.user) throw new AppError('Ban chua dang nhap', 401);
  return req.user.id;
}

export const getCardDetailHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const card = await getCardDetail(uid(req), req.params.cardId as string);
    res.json({ success: true, data: { card } });
  }
);

// ----- Thanh vien the -----
export const addCardMemberHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const member = await addCardMember(
      uid(req),
      req.params.cardId as string,
      (req.body as { userId: string }).userId
    );
    res.status(201).json({ success: true, data: { member } });
  }
);

export const removeCardMemberHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await removeCardMember(
      uid(req),
      req.params.cardId as string,
      req.params.userId as string
    );
    res.json({ success: true, message: 'Da bo thanh vien khoi the' });
  }
);

// ----- Checklist -----
export const addChecklistHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as {
      title?: string;
      copyFromChecklistId?: string;
    };
    const checklist = await addChecklist(
      uid(req),
      req.params.cardId as string,
      body.title ?? '',
      body.copyFromChecklistId
    );
    res.status(201).json({ success: true, data: { checklist } });
  }
);

export const updateChecklistHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const checklist = await updateChecklist(
      uid(req),
      req.params.checklistId as string,
      (req.body as { title: string }).title
    );
    res.json({ success: true, data: { checklist } });
  }
);

export const deleteChecklistHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteChecklist(uid(req), req.params.checklistId as string);
    res.json({ success: true, message: 'Da xoa checklist' });
  }
);

export const addChecklistItemHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const item = await addChecklistItem(
      uid(req),
      req.params.checklistId as string,
      (req.body as { content: string }).content
    );
    res.status(201).json({ success: true, data: { item } });
  }
);

export const updateChecklistItemHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const item = await updateChecklistItem(
      uid(req),
      req.params.itemId as string,
      req.body as { content?: string; isDone?: boolean }
    );
    res.json({ success: true, data: { item } });
  }
);

export const deleteChecklistItemHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteChecklistItem(uid(req), req.params.itemId as string);
    res.json({ success: true, message: 'Da xoa muc' });
  }
);

// ----- Binh luan -----
export const addCommentHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const comment = await addComment(
      uid(req),
      req.params.cardId as string,
      (req.body as { text: string }).text
    );
    res.status(201).json({ success: true, data: { comment } });
  }
);

export const updateCommentHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const comment = await updateComment(
      uid(req),
      req.params.commentId as string,
      (req.body as { text: string }).text
    );
    res.json({ success: true, data: { comment } });
  }
);

export const deleteCommentHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteComment(uid(req), req.params.commentId as string);
    res.json({ success: true, message: 'Da xoa binh luan' });
  }
);

// ----- Gan / bo nhan tren the -----
export const attachLabelHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const label = await attachLabel(
      uid(req),
      req.params.cardId as string,
      req.params.labelId as string
    );
    res.json({ success: true, data: { label } });
  }
);

export const detachLabelHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await detachLabel(
      uid(req),
      req.params.cardId as string,
      req.params.labelId as string
    );
    res.json({ success: true, message: 'Da bo nhan' });
  }
);
