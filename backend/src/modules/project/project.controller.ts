import type { Request, Response } from 'express';
import { AppError } from '../../utils/AppError';
import { asyncHandler } from '../../utils/asyncHandler';
import type {
  AddProjectMemberInput,
  CreateProjectInput,
  StarProjectInput,
  UpdateProjectInput,
  UpdateProjectMemberRoleInput,
} from './project.schema';
import {
  addProjectMember,
  createProject,
  deleteProject,
  getProjectDetail,
  listMyProjects,
  removeProjectMember,
  setProjectStar,
  updateProject,
  updateProjectMemberRole,
} from './project.service';

function requireUserId(req: Request): string {
  if (!req.user) {
    throw new AppError('Ban chua dang nhap', 401);
  }
  return req.user.id;
}

export const createProjectHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const project = await createProject(
      requireUserId(req),
      req.body as CreateProjectInput
    );
    res
      .status(201)
      .json({ success: true, message: 'Tao du an thanh cong', data: { project } });
  }
);

export const listMyProjectsHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const projects = await listMyProjects(requireUserId(req));
    res.json({ success: true, data: { projects } });
  }
);

export const getProjectDetailHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const project = await getProjectDetail(
      requireUserId(req),
      req.params.projectId as string
    );
    res.json({ success: true, data: { project } });
  }
);

export const updateProjectHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const project = await updateProject(
      requireUserId(req),
      req.params.projectId as string,
      req.body as UpdateProjectInput
    );
    res.json({ success: true, message: 'Cap nhat du an thanh cong', data: { project } });
  }
);

export const deleteProjectHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await deleteProject(requireUserId(req), req.params.projectId as string);
    res.json({ success: true, message: 'Da xoa du an' });
  }
);

export const starProjectHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await setProjectStar(
      requireUserId(req),
      req.params.projectId as string,
      (req.body as StarProjectInput).starred
    );
    res.json({ success: true, message: 'Da cap nhat danh sao', data: result });
  }
);

export const addProjectMemberHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const membership = await addProjectMember(
      requireUserId(req),
      req.params.projectId as string,
      req.body as AddProjectMemberInput
    );
    res
      .status(201)
      .json({ success: true, message: 'Da them thanh vien', data: { membership } });
  }
);

export const removeProjectMemberHandler = asyncHandler(
  async (req: Request, res: Response) => {
    await removeProjectMember(
      requireUserId(req),
      req.params.projectId as string,
      req.params.userId as string
    );
    res.json({ success: true, message: 'Da xoa thanh vien khoi du an' });
  }
);

export const updateProjectMemberRoleHandler = asyncHandler(
  async (req: Request, res: Response) => {
    const membership = await updateProjectMemberRole(
      requireUserId(req),
      req.params.projectId as string,
      req.params.userId as string,
      (req.body as UpdateProjectMemberRoleInput).role
    );
    res.json({ success: true, message: 'Da cap nhat vai tro', data: { membership } });
  }
);
