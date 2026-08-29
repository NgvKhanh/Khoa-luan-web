import { Router } from 'express';
import { uploadBoardBackground } from '../../config/upload';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import {
  createBoardHandler,
  deleteBoardBackgroundHandler,
  deleteBoardHandler,
  getBoardHandler,
  listMyBoardsHandler,
  setBoardStarHandler,
  updateBoardHandler,
  uploadBoardBackgroundHandler,
} from './board.controller';
import { createBoardSchema, updateBoardSchema } from './board.schema';
import {
  approveJoinRequestHandler,
  createInviteLinkHandler,
  disableInviteLinkHandler,
  getInviteLinkHandler,
  listJoinRequestsHandler,
  previewInviteHandler,
  rejectJoinRequestHandler,
  requestToJoinHandler,
} from './boardShare.controller';

const router = Router();

router.use(requireAuth);

// Vao bang bang link moi (dat truoc "/:boardId" de khong bi nham)
router.get('/join/:token', previewInviteHandler);
router.post('/join/:token', requestToJoinHandler);

router.get('/', listMyBoardsHandler);
router.post('/', validateBody(createBoardSchema), createBoardHandler);
router.get('/:boardId', getBoardHandler);
router.patch('/:boardId', validateBody(updateBoardSchema), updateBoardHandler);
router.put('/:boardId/star', setBoardStarHandler);
router.delete('/:boardId', deleteBoardHandler);

// Anh nen
router.post(
  '/:boardId/background',
  uploadBoardBackground,
  uploadBoardBackgroundHandler
);
router.delete('/:boardId/background', deleteBoardBackgroundHandler);

// Link moi (Quan tri vien)
router.get('/:boardId/invite-link', getInviteLinkHandler);
router.post('/:boardId/invite-link', createInviteLinkHandler);
router.delete('/:boardId/invite-link', disableInviteLinkHandler);

// Yeu cau tham gia (Quan tri vien duyet)
router.get('/:boardId/join-requests', listJoinRequestsHandler);
router.post(
  '/:boardId/join-requests/:requestId/approve',
  approveJoinRequestHandler
);
router.post(
  '/:boardId/join-requests/:requestId/reject',
  rejectJoinRequestHandler
);

export default router;
