import { Router } from 'express';
import { env } from '../../../config/env';
import { AppError } from '../../../utils/AppError';
import { asyncHandler } from '../../../utils/asyncHandler';
import { chatLimiter } from '../../../middleware/rateLimit.middleware';
import { validateBody } from '../../../middleware/validate.middleware';
import { v2ChoiceSchema, v2MessageSchema, v2MoreSchema } from './chat.v2.contract';
import { conversationHistory, historyListSchema, historyTurnsSchema, listConversations, persistentChoice, persistentMessage, persistentMore } from './chat.v2.history';
import { z } from 'zod';
import { v2LlmAvailable } from './chat.v2.llm';

export const v2ChatRoutes = Router();
const active = new Set<string>();
v2ChatRoutes.get('/status', (_req, res) => res.json({ success: true, data: { engine: env.chatEngine, llmAvailable: v2LlmAvailable(), version: 'v2' } }));
v2ChatRoutes.get('/conversations', asyncHandler(async (req, res) => {
  const input = historyListSchema.safeParse(req.query);
  if (!input.success) throw new AppError('Trang lịch sử không hợp lệ.', 400);
  res.json({ success: true, data: await listConversations(req.user!.id, input.data.page) });
}));
v2ChatRoutes.get('/conversations/:id', asyncHandler(async (req, res) => {
  const id = z.string().uuid().safeParse(req.params.id);
  const input = historyTurnsSchema.safeParse(req.query);
  if (!id.success || !input.success) throw new AppError('Hội thoại hoặc trang lịch sử không hợp lệ.', 400);
  res.json({ success: true, data: await conversationHistory(req.user!.id, id.data, input.data.before, new Date()) });
}));
function post(path: string, schema: typeof v2MessageSchema | typeof v2ChoiceSchema | typeof v2MoreSchema) {
  v2ChatRoutes.post(path, chatLimiter, validateBody(schema), asyncHandler(async (req, res) => {
    const userId = req.user!.id;
    if (active.has(userId)) throw new AppError('Trợ lý đang xử lý câu trước. Hãy chờ một chút.', 429);
    active.add(userId);
    try {
      const context = { now: new Date() };
      const data = path === '/messages' ? await persistentMessage(userId, v2MessageSchema.parse(req.body), context)
        : path === '/messages/choice' ? await persistentChoice(userId, v2ChoiceSchema.parse(req.body), context)
        : await persistentMore(userId, v2MoreSchema.parse(req.body), context);
      res.json({ success: true, data });
    } finally { active.delete(userId); }
  }));
}
post('/messages', v2MessageSchema);
post('/messages/choice', v2ChoiceSchema);
post('/messages/more', v2MoreSchema);
