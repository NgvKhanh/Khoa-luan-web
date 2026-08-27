import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import {
  getMe,
  googleAuth,
  login,
  logout,
  register,
  updateMe,
} from './auth.controller';
import {
  googleAuthSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from './auth.schema';

const router = Router();

router.post('/register', validateBody(registerSchema), register);
router.post('/login', validateBody(loginSchema), login);
router.post('/google', validateBody(googleAuthSchema), googleAuth);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);
router.patch('/me', requireAuth, validateBody(updateProfileSchema), updateMe);

export default router;
