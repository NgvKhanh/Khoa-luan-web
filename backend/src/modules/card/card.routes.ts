import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import {
  createCardHandler,
  deleteCardHandler,
  moveCardHandler,
  updateCardHandler,
} from './card.controller';
import { createCardSchema, moveCardSchema, updateCardSchema } from './card.schema';

// Gan vao /api/lists/:listId/cards
export const listCardRoutes = Router({ mergeParams: true });
listCardRoutes.use(requireAuth);
listCardRoutes.post('/', validateBody(createCardSchema), createCardHandler);

// Gan vao /api/cards
export const cardRoutes = Router();
cardRoutes.use(requireAuth);
cardRoutes.patch('/:cardId', validateBody(updateCardSchema), updateCardHandler);
cardRoutes.patch('/:cardId/move', validateBody(moveCardSchema), moveCardHandler);
cardRoutes.delete('/:cardId', deleteCardHandler);
