import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import {
  addDependencyHandler,
  listDependenciesHandler,
  removeDependencyHandler,
} from './taskDependency.controller';
import { addDependencySchema } from './taskDependency.schema';

// Gan vao /api/tasks/:taskId/dependencies
export const taskDependencyRoutes = Router({ mergeParams: true });
taskDependencyRoutes.use(requireAuth);
taskDependencyRoutes.post(
  '/',
  validateBody(addDependencySchema),
  addDependencyHandler
);
taskDependencyRoutes.get('/', listDependenciesHandler);

// Gan vao /api/dependencies/:dependencyId
export const dependencyRoutes = Router();
dependencyRoutes.use(requireAuth);
dependencyRoutes.delete('/:dependencyId', removeDependencyHandler);
