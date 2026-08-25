import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import {
  createCommentHandler,
  deleteCommentHandler,
  listCommentsHandler,
  updateCommentHandler,
} from './comment.controller';
import { createCommentSchema, updateCommentSchema } from './comment.schema';

// Gan vao /api/tasks/:taskId/comments
export const taskCommentRoutes = Router({ mergeParams: true });
taskCommentRoutes.use(requireAuth);
taskCommentRoutes.post('/', validateBody(createCommentSchema), createCommentHandler);
taskCommentRoutes.get('/', listCommentsHandler);

// Gan vao /api/comments/:commentId
export const commentRoutes = Router();
commentRoutes.use(requireAuth);
commentRoutes.patch(
  '/:commentId',
  validateBody(updateCommentSchema),
  updateCommentHandler
);
commentRoutes.delete('/:commentId', deleteCommentHandler);
