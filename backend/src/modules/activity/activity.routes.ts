import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { assertBoardView } from '../board/board.service';
import {
  listBoardActivity,
  listHomeActivity,
  listMyActivity,
} from './activity.service';

const router = Router();
router.use(requireAuth);

// GET /api/activities/me -> nhat ky thao tac cua toi
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError('Ban chua dang nhap', 401);
    const activities = await listMyActivity(req.user.id);
    res.json({ success: true, data: { activities } });
  })
);

// GET /api/activities/home -> nhat ky gop tren moi bang cua toi
router.get(
  '/home',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError('Ban chua dang nhap', 401);
    const activities = await listHomeActivity(req.user.id);
    res.json({ success: true, data: { activities } });
  })
);

// GET /api/activities/board/:boardId -> nhat ky ca bang
router.get(
  '/board/:boardId',
  asyncHandler(async (req, res) => {
    if (!req.user) throw new AppError('Ban chua dang nhap', 401);
    await assertBoardView(req.user.id, req.params.boardId as string);
    const activities = await listBoardActivity(req.params.boardId as string);
    res.json({ success: true, data: { activities } });
  })
);

export default router;
