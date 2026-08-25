import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import {
  addTeamMemberHandler,
  createTeamHandler,
  deleteTeamHandler,
  getTeamDetailHandler,
  listMyTeamsHandler,
  removeTeamMemberHandler,
  updateMemberRoleHandler,
  updateTeamHandler,
} from './team.controller';
import {
  addTeamMemberSchema,
  createTeamSchema,
  updateMemberRoleSchema,
  updateTeamSchema,
} from './team.schema';

const router = Router();

router.use(requireAuth);

router.post('/', validateBody(createTeamSchema), createTeamHandler);
router.get('/', listMyTeamsHandler);
router.get('/:teamId', getTeamDetailHandler);
router.patch('/:teamId', validateBody(updateTeamSchema), updateTeamHandler);
router.delete('/:teamId', deleteTeamHandler);

router.post(
  '/:teamId/members',
  validateBody(addTeamMemberSchema),
  addTeamMemberHandler
);
router.delete('/:teamId/members/:userId', removeTeamMemberHandler);
router.patch(
  '/:teamId/members/:userId/role',
  validateBody(updateMemberRoleSchema),
  updateMemberRoleHandler
);

export default router;
