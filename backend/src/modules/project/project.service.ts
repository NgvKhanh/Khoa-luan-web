import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import type {
  AddProjectMemberInput,
  CreateProjectInput,
  UpdateProjectInput,
} from './project.schema';

const MEMBER_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
} as const;

async function getProjectMembership(projectId: string, userId: string) {
  return prisma.projectMember.findFirst({
    where: { projectId, userId, deletedAt: null },
  });
}

async function assertProjectMember(projectId: string, userId: string) {
  const membership = await getProjectMembership(projectId, userId);
  if (!membership) {
    throw new AppError('Ban khong phai thanh vien cua du an nay', 403);
  }
  return membership;
}

async function assertProjectManager(projectId: string, userId: string) {
  const membership = await getProjectMembership(projectId, userId);
  if (!membership || membership.role !== 'MANAGER') {
    throw new AppError(
      'Chi nguoi quan ly du an moi co quyen thuc hien thao tac nay',
      403
    );
  }
  return membership;
}

async function assertTeamMember(teamId: string, userId: string) {
  const membership = await prisma.teamMember.findFirst({
    where: { teamId, userId, deletedAt: null },
  });
  if (!membership) {
    throw new AppError('Ban khong phai thanh vien cua nhom nay', 403);
  }
  return membership;
}

export async function createProject(userId: string, input: CreateProjectInput) {
  const team = await prisma.team.findFirst({
    where: { id: input.teamId, deletedAt: null },
  });
  if (!team) {
    throw new AppError('Khong tim thay nhom', 404);
  }

  await assertTeamMember(input.teamId, userId);

  const project = await prisma.project.create({
    data: {
      teamId: input.teamId,
      name: input.name,
      description: input.description,
      members: {
        create: { userId, role: 'MANAGER' },
      },
    },
  });

  return project;
}

export async function listMyProjects(userId: string) {
  const memberships = await prisma.projectMember.findMany({
    where: { userId, deletedAt: null, project: { deletedAt: null } },
    include: {
      project: {
        include: {
          team: { select: { id: true, name: true } },
          _count: { select: { members: { where: { deletedAt: null } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return memberships.map((m) => ({
    ...m.project,
    memberCount: m.project._count.members,
    myRole: m.role,
  }));
}

export async function getProjectDetail(userId: string, projectId: string) {
  await assertProjectMember(projectId, userId);

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
    include: {
      team: { select: { id: true, name: true } },
      members: {
        where: { deletedAt: null },
        include: { user: { select: MEMBER_USER_SELECT } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });

  if (!project) {
    throw new AppError('Khong tim thay du an', 404);
  }

  return project;
}

export async function updateProject(
  userId: string,
  projectId: string,
  input: UpdateProjectInput
) {
  await assertProjectManager(projectId, userId);

  if (Object.keys(input).length === 0) {
    throw new AppError('Khong co du lieu nao de cap nhat', 400);
  }

  return prisma.project.update({
    where: { id: projectId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
    },
  });
}

export async function deleteProject(userId: string, projectId: string) {
  await assertProjectManager(projectId, userId);

  const now = new Date();

  await prisma.$transaction([
    prisma.project.update({
      where: { id: projectId },
      data: { deletedAt: now },
    }),
    // Xoa mem toan bo cong viec thuoc du an nay
    prisma.task.updateMany({
      where: { projectId, deletedAt: null },
      data: { deletedAt: now },
    }),
  ]);
}

export async function addProjectMember(
  actorUserId: string,
  projectId: string,
  input: AddProjectMemberInput
) {
  await assertProjectManager(projectId, actorUserId);

  const project = await prisma.project.findFirst({
    where: { id: projectId, deletedAt: null },
  });
  if (!project) {
    throw new AppError('Khong tim thay du an', 404);
  }

  const targetUser = await prisma.user.findFirst({
    where: { email: input.email, deletedAt: null },
  });
  if (!targetUser) {
    throw new AppError('Khong tim thay nguoi dung voi email nay', 404);
  }

  // Chi cho phep them nguoi da la thanh vien cua nhom so huu du an
  const teamMembership = await prisma.teamMember.findFirst({
    where: { teamId: project.teamId, userId: targetUser.id, deletedAt: null },
  });
  if (!teamMembership) {
    throw new AppError(
      'Nguoi nay chua la thanh vien cua nhom, hay them vao nhom truoc',
      400
    );
  }

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: targetUser.id } },
  });

  if (existing && existing.deletedAt === null) {
    throw new AppError('Nguoi nay da la thanh vien cua du an', 409);
  }

  const membership = existing
    ? await prisma.projectMember.update({
        where: { id: existing.id },
        data: { deletedAt: null, role: 'MEMBER', joinedAt: new Date() },
        include: { user: { select: MEMBER_USER_SELECT } },
      })
    : await prisma.projectMember.create({
        data: { projectId, userId: targetUser.id, role: 'MEMBER' },
        include: { user: { select: MEMBER_USER_SELECT } },
      });

  return membership;
}

export async function removeProjectMember(
  actorUserId: string,
  projectId: string,
  targetUserId: string
) {
  await assertProjectManager(projectId, actorUserId);

  const membership = await getProjectMembership(projectId, targetUserId);
  if (!membership) {
    throw new AppError('Nguoi nay khong phai thanh vien cua du an', 404);
  }

  if (membership.role === 'MANAGER') {
    const managerCount = await prisma.projectMember.count({
      where: { projectId, role: 'MANAGER', deletedAt: null },
    });
    if (managerCount <= 1) {
      throw new AppError(
        'Khong the xoa nguoi quan ly duy nhat. Hay chi dinh nguoi quan ly khac truoc.',
        400
      );
    }
  }

  await prisma.projectMember.update({
    where: { id: membership.id },
    data: { deletedAt: new Date() },
  });
}

export async function updateProjectMemberRole(
  actorUserId: string,
  projectId: string,
  targetUserId: string,
  role: 'MANAGER' | 'MEMBER'
) {
  await assertProjectManager(projectId, actorUserId);

  const membership = await getProjectMembership(projectId, targetUserId);
  if (!membership) {
    throw new AppError('Nguoi nay khong phai thanh vien cua du an', 404);
  }

  if (membership.role === 'MANAGER' && role === 'MEMBER') {
    const managerCount = await prisma.projectMember.count({
      where: { projectId, role: 'MANAGER', deletedAt: null },
    });
    if (managerCount <= 1) {
      throw new AppError(
        'Khong the ha cap nguoi quan ly duy nhat. Hay chi dinh nguoi quan ly khac truoc.',
        400
      );
    }
  }

  return prisma.projectMember.update({
    where: { id: membership.id },
    data: { role },
    include: { user: { select: MEMBER_USER_SELECT } },
  });
}
