import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import {
  createSubtaskHandler,
  deleteSubtaskHandler,
  listSubtasksHandler,
  updateSubtaskHandler,
} from './subtask.controller';
import { createSubtaskSchema, updateSubtaskSchema } from './subtask.schema';

// Gan vao /api/tasks/:taskId/subtasks
export const taskSubtaskRoutes = Router({ mergeParams: true });
taskSubtaskRoutes.use(requireAuth);
taskSubtaskRoutes.post('/', validateBody(createSubtaskSchema), createSubtaskHandler);
taskSubtaskRoutes.get('/', listSubtasksHandler);

// Gan vao /api/subtasks/:subtaskId
export const subtaskRoutes = Router();
subtaskRoutes.use(requireAuth);
subtaskRoutes.patch(
  '/:subtaskId',
  validateBody(updateSubtaskSchema),
  updateSubtaskHandler
);
subtaskRoutes.delete('/:subtaskId', deleteSubtaskHandler);
