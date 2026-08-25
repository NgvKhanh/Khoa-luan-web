import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import type {
  AddTeamMemberInput,
  CreateTeamInput,
  UpdateTeamInput,
} from './team.schema';

const MEMBER_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
} as const;

/** Kiem tra nguoi dung co la thanh vien (con hoat dong) cua nhom hay khong. */
async function getMembership(teamId: string, userId: string) {
  return prisma.teamMember.findFirst({
    where: { teamId, userId, deletedAt: null },
  });
}

async function assertTeamMember(teamId: string, userId: string) {
  const membership = await getMembership(teamId, userId);
  if (!membership) {
    throw new AppError('Ban khong phai thanh vien cua nhom nay', 403);
  }
  return membership;
}

async function assertTeamLeader(teamId: string, userId: string) {
  const membership = await getMembership(teamId, userId);
  if (!membership || membership.role !== 'LEADER') {
    throw new AppError('Chi truong nhom moi co quyen thuc hien thao tac nay', 403);
  }
  return membership;
}

export async function createTeam(userId: string, input: CreateTeamInput) {
  const team = await prisma.team.create({
    data: {
      name: input.name,
      description: input.description,
      members: {
        create: { userId, role: 'LEADER' },
      },
    },
  });

  return team;
}

export async function listMyTeams(userId: string) {
  const memberships = await prisma.teamMember.findMany({
    where: { userId, deletedAt: null, team: { deletedAt: null } },
    include: {
      team: {
        include: {
          _count: { select: { members: { where: { deletedAt: null } } } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return memberships.map((m) => ({
    ...m.team,
    memberCount: m.team._count.members,
    myRole: m.role,
  }));
}

export async function getTeamDetail(userId: string, teamId: string) {
  await assertTeamMember(teamId, userId);

  const team = await prisma.team.findFirst({
    where: { id: teamId, deletedAt: null },
    include: {
      members: {
        where: { deletedAt: null },
        include: { user: { select: MEMBER_USER_SELECT } },
        orderBy: { joinedAt: 'asc' },
      },
    },
  });

  if (!team) {
    throw new AppError('Khong tim thay nhom', 404);
  }

  return team;
}

export async function updateTeam(
  userId: string,
  teamId: string,
  input: UpdateTeamInput
) {
  await assertTeamLeader(teamId, userId);

  if (Object.keys(input).length === 0) {
    throw new AppError('Khong co du lieu nao de cap nhat', 400);
  }

  const team = await prisma.team.update({
    where: { id: teamId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined
        ? { description: input.description }
        : {}),
    },
  });

  return team;
}

export async function deleteTeam(userId: string, teamId: string) {
  await assertTeamLeader(teamId, userId);

  const now = new Date();

  await prisma.$transaction([
    prisma.team.update({ where: { id: teamId }, data: { deletedAt: now } }),
    // Xoa mem toan bo du an thuoc nhom nay de tranh du an "mo coi" van hien thi
    prisma.project.updateMany({
      where: { teamId, deletedAt: null },
      data: { deletedAt: now },
    }),
  ]);
}

export async function addTeamMember(
  actorUserId: string,
  teamId: string,
  input: AddTeamMemberInput
) {
  await assertTeamLeader(teamId, actorUserId);

  const targetUser = await prisma.user.findFirst({
    where: { email: input.email, deletedAt: null },
  });

  if (!targetUser) {
    throw new AppError('Khong tim thay nguoi dung voi email nay', 404);
  }

  const existing = await prisma.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId: targetUser.id } },
  });

  if (existing && existing.deletedAt === null) {
    throw new AppError('Nguoi nay da la thanh vien cua nhom', 409);
  }

  const membership = existing
    ? await prisma.teamMember.update({
        where: { id: existing.id },
        data: { deletedAt: null, role: 'MEMBER', joinedAt: new Date() },
        include: { user: { select: MEMBER_USER_SELECT } },
      })
    : await prisma.teamMember.create({
        data: { teamId, userId: targetUser.id, role: 'MEMBER' },
        include: { user: { select: MEMBER_USER_SELECT } },
      });

  return membership;
}

export async function removeTeamMember(
  actorUserId: string,
  teamId: string,
  targetUserId: string
) {
  await assertTeamLeader(teamId, actorUserId);

  const membership = await getMembership(teamId, targetUserId);
  if (!membership) {
    throw new AppError('Nguoi nay khong phai thanh vien cua nhom', 404);
  }

  if (membership.role === 'LEADER') {
    const leaderCount = await prisma.teamMember.count({
      where: { teamId, role: 'LEADER', deletedAt: null },
    });
    if (leaderCount <= 1) {
      throw new AppError(
        'Khong the xoa truong nhom duy nhat. Hay chi dinh truong nhom khac truoc.',
        400
      );
    }
  }

  await prisma.teamMember.update({
    where: { id: membership.id },
    data: { deletedAt: new Date() },
  });
}

export async function updateMemberRole(
  actorUserId: string,
  teamId: string,
  targetUserId: string,
  role: 'LEADER' | 'MEMBER'
) {
  await assertTeamLeader(teamId, actorUserId);

  const membership = await getMembership(teamId, targetUserId);
  if (!membership) {
    throw new AppError('Nguoi nay khong phai thanh vien cua nhom', 404);
  }

  if (membership.role === 'LEADER' && role === 'MEMBER') {
    const leaderCount = await prisma.teamMember.count({
      where: { teamId, role: 'LEADER', deletedAt: null },
    });
    if (leaderCount <= 1) {
      throw new AppError(
        'Khong the ha cap truong nhom duy nhat. Hay chi dinh truong nhom khac truoc.',
        400
      );
    }
  }

  return prisma.teamMember.update({
    where: { id: membership.id },
    data: { role },
    include: { user: { select: MEMBER_USER_SELECT } },
  });
}
