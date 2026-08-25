import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import type {
  AddTeamMemberInput,
  CreateTeamInput,
  UpdateMemberRoleInput,
  UpdateTeamInput,
} from './team.schema';
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  getTeamDetail,
  listMyTeams,
  removeTeamMember,
  updateMemberRole,
  updateTeam,
} from './team.service';

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError('Ban chua dang nhap', 401);
  }
  return req.user.id;
}

export const createTeamHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const team = await createTeam(requireUserId(req), req.body as CreateTeamInput);
    res.status(201).json({ success: true, message: 'Tao nhom thanh cong', data: { team } });
  }
);

export const listMyTeamsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const teams = await listMyTeams(requireUserId(req));
    res.json({ success: true, data: { teams } });
  }
);

export const getTeamDetailHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const team = await getTeamDetail(requireUserId(req), req.params.teamId as string);
    res.json({ success: true, data: { team } });
  }
);

export const updateTeamHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const team = await updateTeam(
      requireUserId(req),
      req.params.teamId as string,
      req.body as UpdateTeamInput
    );
    res.json({ success: true, message: 'Cap nhat nhom thanh cong', data: { team } });
  }
);

export const deleteTeamHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteTeam(requireUserId(req), req.params.teamId as string);
    res.json({ success: true, message: 'Da xoa nhom' });
  }
);

export const addTeamMemberHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const membership = await addTeamMember(
      requireUserId(req),
      req.params.teamId as string,
      req.body as AddTeamMemberInput
    );
    res
      .status(201)
      .json({ success: true, message: 'Da them thanh vien', data: { membership } });
  }
);

export const removeTeamMemberHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await removeTeamMember(
      requireUserId(req),
      req.params.teamId as string,
      req.params.userId as string
    );
    res.json({ success: true, message: 'Da xoa thanh vien khoi nhom' });
  }
);

export const updateMemberRoleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const membership = await updateMemberRole(
      requireUserId(req),
      req.params.teamId as string,
      req.params.userId as string,
      (req.body as UpdateMemberRoleInput).role
    );
    res.json({ success: true, message: 'Da cap nhat vai tro', data: { membership } });
  }
);
