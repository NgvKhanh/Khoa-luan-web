import { Router } from 'express';
import { uploadCardAttachment } from '../../config/upload';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import {
  archiveCardHandler,
  copyCardHandler,
  createCardHandler,
  deleteCardHandler,
  listCalendarHandler,
  listMyCardsHandler,
  moveCardHandler,
  purgeCardHandler,
  restoreCardHandler,
  updateCardHandler,
} from './card.controller';
import {
  copyCardSchema,
  createCardSchema,
  moveCardSchema,
  updateCardSchema,
} from './card.schema';
import {
  addAttachmentHandler,
  addCardMemberHandler,
  addChecklistHandler,
  addChecklistItemHandler,
  addCommentHandler,
  attachLabelHandler,
  convertItemToCardHandler,
  deleteAttachmentHandler,
  deleteChecklistHandler,
  deleteChecklistItemHandler,
  deleteCommentHandler,
  detachLabelHandler,
  getCardDetailHandler,
  removeCardMemberHandler,
  reorderChecklistItemsHandler,
  updateChecklistHandler,
  updateChecklistItemHandler,
  updateCommentHandler,
} from './cardExtras.controller';
import {
  addCardMemberSchema,
  addChecklistItemSchema,
  addChecklistSchema,
  commentSchema,
  reorderChecklistItemsSchema,
  updateChecklistItemSchema,
  updateChecklistSchema,
} from './cardExtras.schema';

// Gan vao /api/lists/:listId/cards
export const listCardRoutes = Router({ mergeParams: true });
listCardRoutes.use(requireAuth);
listCardRoutes.post('/', validateBody(createCardSchema), createCardHandler);

// Gan vao /api/cards
export const cardRoutes = Router();
cardRoutes.use(requireAuth);

cardRoutes.get('/mine', listMyCardsHandler);
cardRoutes.get('/calendar', listCalendarHandler);
cardRoutes.get('/:cardId', getCardDetailHandler);
cardRoutes.patch('/:cardId', validateBody(updateCardSchema), updateCardHandler);
cardRoutes.patch('/:cardId/move', validateBody(moveCardSchema), moveCardHandler);
cardRoutes.post('/:cardId/copy', validateBody(copyCardSchema), copyCardHandler);
cardRoutes.post('/:cardId/archive', archiveCardHandler);
cardRoutes.post('/:cardId/restore', restoreCardHandler);
cardRoutes.delete('/:cardId/purge', purgeCardHandler);
cardRoutes.delete('/:cardId', deleteCardHandler);

// Thanh vien the
cardRoutes.post(
  '/:cardId/members',
  validateBody(addCardMemberSchema),
  addCardMemberHandler
);
cardRoutes.delete('/:cardId/members/:userId', removeCardMemberHandler);

// Nhan tren the
cardRoutes.put('/:cardId/labels/:labelId', attachLabelHandler);
cardRoutes.delete('/:cardId/labels/:labelId', detachLabelHandler);

// Checklist
cardRoutes.post(
  '/:cardId/checklists',
  validateBody(addChecklistSchema),
  addChecklistHandler
);

// Binh luan
cardRoutes.post(
  '/:cardId/comments',
  validateBody(commentSchema),
  addCommentHandler
);

// Tep dinh kem (multipart, field "file")
cardRoutes.post(
  '/:cardId/attachments',
  uploadCardAttachment,
  addAttachmentHandler
);

// Gan vao /api/checklists
export const checklistRoutes = Router();
checklistRoutes.use(requireAuth);
checklistRoutes.patch(
  '/:checklistId',
  validateBody(updateChecklistSchema),
  updateChecklistHandler
);
checklistRoutes.delete('/:checklistId', deleteChecklistHandler);
checklistRoutes.post(
  '/:checklistId/items',
  validateBody(addChecklistItemSchema),
  addChecklistItemHandler
);
checklistRoutes.patch(
  '/:checklistId/reorder',
  validateBody(reorderChecklistItemsSchema),
  reorderChecklistItemsHandler
);

// Gan vao /api/checklist-items
export const checklistItemRoutes = Router();
checklistItemRoutes.use(requireAuth);
checklistItemRoutes.patch(
  '/:itemId',
  validateBody(updateChecklistItemSchema),
  updateChecklistItemHandler
);
checklistItemRoutes.post('/:itemId/convert-to-card', convertItemToCardHandler);
checklistItemRoutes.delete('/:itemId', deleteChecklistItemHandler);

// Gan vao /api/attachments
export const attachmentRoutes = Router();
attachmentRoutes.use(requireAuth);
attachmentRoutes.delete('/:attachmentId', deleteAttachmentHandler);

// Gan vao /api/comments
export const commentRoutes = Router();
commentRoutes.use(requireAuth);
commentRoutes.patch(
  '/:commentId',
  validateBody(commentSchema),
  updateCommentHandler
);
commentRoutes.delete('/:commentId', deleteCommentHandler);
