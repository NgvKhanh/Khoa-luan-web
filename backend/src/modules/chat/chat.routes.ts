import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { chatLimiter } from '../../middleware/rateLimit.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import { getChatStatusHandler, postChoiceHandler, postMessageHandler, postMoreHandler } from './chat.controller';
import { chatChoiceSchema, chatMessageSchema, chatMoreSchema } from './chat.schema';

// Gan vao /api/chat. Limiter dat TRUOC validate: yeu cau sai dinh dang cung ton han muc.
export const chatRoutes = Router();
chatRoutes.use(requireAuth);
chatRoutes.get('/status', getChatStatusHandler);
chatRoutes.post('/messages', chatLimiter, validateBody(chatMessageSchema), postMessageHandler);
// Hai duong duoi KHONG goi LLM (tra loi cau hoi lai / xem them) nhung van kiem lai quyen.
chatRoutes.post('/messages/choice', chatLimiter, validateBody(chatChoiceSchema), postChoiceHandler);
chatRoutes.post('/messages/more', chatLimiter, validateBody(chatMoreSchema), postMoreHandler);
