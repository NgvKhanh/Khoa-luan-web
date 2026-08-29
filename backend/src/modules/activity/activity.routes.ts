import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import { listMyActivity } from './activity.service';

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

export default router;
