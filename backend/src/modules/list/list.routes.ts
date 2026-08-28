import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import {
  createListHandler,
  deleteListHandler,
  listBoardListsHandler,
  updateListHandler,
} from './list.controller';
import { createListSchema, updateListSchema } from './list.schema';

// Gan vao /api/boards/:boardId/lists
export const boardListRoutes = Router({ mergeParams: true });
boardListRoutes.use(requireAuth);
boardListRoutes.get('/', listBoardListsHandler);
boardListRoutes.post('/', validateBody(createListSchema), createListHandler);

// Gan vao /api/lists
export const listRoutes = Router();
listRoutes.use(requireAuth);
listRoutes.patch('/:listId', validateBody(updateListSchema), updateListHandler);
listRoutes.delete('/:listId', deleteListHandler);
