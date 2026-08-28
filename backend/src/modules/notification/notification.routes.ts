import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import {
  listNotificationsHandler,
  markAllReadHandler,
  markReadHandler,
  unreadCountHandler,
} from './notification.controller';

// Gan vao /api/notifications
const router = Router();
router.use(requireAuth);

router.get('/', listNotificationsHandler);
router.get('/unread-count', unreadCountHandler);
router.post('/read-all', markAllReadHandler);
router.post('/:id/read', markReadHandler);

export default router;
