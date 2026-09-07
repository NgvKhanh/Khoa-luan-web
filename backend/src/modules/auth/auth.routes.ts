import { Router } from 'express';
import { uploadAvatar } from '../../config/upload';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import {
  changePassword,
  getMe,
  login,
  logout,
  register,
  updateMe,
  uploadMyAvatar,
} from './auth.controller';
import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from './auth.schema';

const router = Router();

router.post('/register', validateBody(registerSchema), register);
router.post('/login', validateBody(loginSchema), login);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);
router.patch('/me', requireAuth, validateBody(updateProfileSchema), updateMe);
router.post('/me/avatar', requireAuth, uploadAvatar, uploadMyAvatar);
router.patch(
  '/password',
  requireAuth,
  validateBody(changePasswordSchema),
  changePassword
);

export default router;
