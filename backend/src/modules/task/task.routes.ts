import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import {
  createTaskHandler,
  deleteTaskHandler,
  getTaskDetailHandler,
  listProjectTasksHandler,
  updateTaskHandler,
} from './task.controller';
import { createTaskSchema, updateTaskSchema } from './task.schema';

// Gan vao /api/projects/:projectId/tasks
export const projectTaskRoutes = Router({ mergeParams: true });
projectTaskRoutes.use(requireAuth);
projectTaskRoutes.post('/', validateBody(createTaskSchema), createTaskHandler);
projectTaskRoutes.get('/', listProjectTasksHandler);

// Gan vao /api/tasks/:taskId
export const taskRoutes = Router();
taskRoutes.use(requireAuth);
taskRoutes.get('/:taskId', getTaskDetailHandler);
taskRoutes.patch('/:taskId', validateBody(updateTaskSchema), updateTaskHandler);
taskRoutes.delete('/:taskId', deleteTaskHandler);
