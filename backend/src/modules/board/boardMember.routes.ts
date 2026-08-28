import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.middleware';
import { validateBody } from '../../middleware/validate.middleware';
import {
  addBoardMemberHandler,
  listBoardMembersHandler,
  removeBoardMemberHandler,
} from './boardMember.controller';
import { addBoardMemberSchema } from './boardMember.schema';

// Gan vao /api/boards/:boardId/members
export const boardMemberRoutes = Router({ mergeParams: true });
boardMemberRoutes.use(requireAuth);
boardMemberRoutes.get('/', listBoardMembersHandler);
boardMemberRoutes.post('/', validateBody(addBoardMemberSchema), addBoardMemberHandler);
boardMemberRoutes.delete('/:userId', removeBoardMemberHandler);
