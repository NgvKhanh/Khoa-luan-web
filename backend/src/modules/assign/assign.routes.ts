import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { assignSuggestLimiter } from '../../middleware/rateLimit.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import {
  getWeightsHandler,
  outcomeHandler,
  putWeightsHandler,
  resetWeightsHandler,
  suggestHandler,
} from './assign.controller';
import { outcomeSchema, weightsSchema } from './assign.schema';

// Gan vao /api/cards/:cardId/assignment-suggestions
export const cardAssignRoutes = Router({ mergeParams: true });
cardAssignRoutes.use(requireAuth);
// Limiter dat SAU requireAuth (tinh theo nguoi dung) va TRUOC xu ly (yeu cau bi chan khong ton doc CSDL)
cardAssignRoutes.get('/', assignSuggestLimiter, suggestHandler);

// Gan vao /api/assignment/runs
export const assignRunRoutes = Router();
assignRunRoutes.use(requireAuth);
assignRunRoutes.post('/:runId/outcome', validateBody(outcomeSchema), outcomeHandler);

// Gan vao /api/workspaces/:workspaceId/assignment-weights
export const workspaceAssignRoutes = Router({ mergeParams: true });
workspaceAssignRoutes.use(requireAuth);
workspaceAssignRoutes.get('/', getWeightsHandler);
workspaceAssignRoutes.put('/', validateBody(weightsSchema), putWeightsHandler);
workspaceAssignRoutes.delete('/', resetWeightsHandler);
