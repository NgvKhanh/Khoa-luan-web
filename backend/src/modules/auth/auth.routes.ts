import { Router } from 'express';
import { uploadAvatar } from '../../config/upload';
import { requireAuth } from '../../middleware/auth.middleware';
import { authLimiter } from '../../middleware/rateLimit.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import {
  changePassword,
  forgotPassword,
  getMe,
  login,
  logout,
  register,
  resetPassword,
  updateMe,
  uploadMyAvatar,
} from './auth.controller';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  updateProfileSchema,
} from './auth.schema';

const router = Router();

router.post('/register', validateBody(registerSchema), register);
router.post('/login', validateBody(loginSchema), login);
router.post('/logout', logout);
router.post(
  '/forgot-password',
  authLimiter,
  validateBody(forgotPasswordSchema),
  forgotPassword
);
router.post(
  '/reset-password',
  authLimiter,
  validateBody(resetPasswordSchema),
  resetPassword
);
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
