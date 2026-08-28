import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import {
  createBoardHandler,
  deleteBoardHandler,
  listMyBoardsHandler,
  updateBoardHandler,
} from './board.controller';
import { createBoardSchema, updateBoardSchema } from './board.schema';

const router = Router();

router.use(requireAuth);

router.get('/', listMyBoardsHandler);
router.post('/', validateBody(createBoardSchema), createBoardHandler);
router.patch('/:boardId', validateBody(updateBoardSchema), updateBoardHandler);
router.delete('/:boardId', deleteBoardHandler);

export default router;
