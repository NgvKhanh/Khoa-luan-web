import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import {
  createListHandler,
  deleteListHandler,
  listProjectListsHandler,
  updateListHandler,
} from './list.controller';
import { createListSchema, updateListSchema } from './list.schema';

// Gan vao /api/projects/:projectId/lists
export const projectListRoutes = Router({ mergeParams: true });
projectListRoutes.use(requireAuth);
projectListRoutes.get('/', listProjectListsHandler);
projectListRoutes.post('/', validateBody(createListSchema), createListHandler);

// Gan vao /api/lists/:listId
export const listRoutes = Router();
listRoutes.use(requireAuth);
listRoutes.patch('/:listId', validateBody(updateListSchema), updateListHandler);
listRoutes.delete('/:listId', deleteListHandler);
