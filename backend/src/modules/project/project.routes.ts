import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import {
  addProjectMemberHandler,
  createProjectHandler,
  deleteProjectHandler,
  getProjectDetailHandler,
  listMyProjectsHandler,
  removeProjectMemberHandler,
  starProjectHandler,
  updateProjectHandler,
  updateProjectMemberRoleHandler,
} from './project.controller';
import {
  addProjectMemberSchema,
  createProjectSchema,
  starProjectSchema,
  updateProjectMemberRoleSchema,
  updateProjectSchema,
} from './project.schema';

const router = Router();

router.use(requireAuth);

router.post('/', validateBody(createProjectSchema), createProjectHandler);
router.get('/', listMyProjectsHandler);
router.get('/:projectId', getProjectDetailHandler);
router.patch(
  '/:projectId',
  validateBody(updateProjectSchema),
  updateProjectHandler
);
router.delete('/:projectId', deleteProjectHandler);
router.patch(
  '/:projectId/star',
  validateBody(starProjectSchema),
  starProjectHandler
);

router.post(
  '/:projectId/members',
  validateBody(addProjectMemberSchema),
  addProjectMemberHandler
);
router.delete('/:projectId/members/:userId', removeProjectMemberHandler);
router.patch(
  '/:projectId/members/:userId/role',
  validateBody(updateProjectMemberRoleSchema),
  updateProjectMemberRoleHandler
);

export default router;
