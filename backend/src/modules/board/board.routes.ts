import { Router } from 'express';
import { uploadBoardBackground } from '../../config/upload';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import {
  createBoardHandler,
  deleteBoardBackgroundHandler,
  deleteBoardHandler,
  listMyBoardsHandler,
  updateBoardHandler,
  uploadBoardBackgroundHandler,
} from './board.controller';
import { createBoardSchema, updateBoardSchema } from './board.schema';

const router = Router();

router.use(requireAuth);

router.get('/', listMyBoardsHandler);
router.post('/', validateBody(createBoardSchema), createBoardHandler);
router.patch('/:boardId', validateBody(updateBoardSchema), updateBoardHandler);
router.delete('/:boardId', deleteBoardHandler);

// Anh nen
router.post(
  '/:boardId/background',
  uploadBoardBackground,
  uploadBoardBackgroundHandler
);
router.delete('/:boardId/background', deleteBoardBackgroundHandler);

export default router;
