import { prisma } from '../../config/prisma';

interface LogActivityInput {
  entityType: string;
  entityId: string;
  action: string;
  oldValue?: string | null;
  newValue?: string | null;
  actorId: string;
}

/** Ghi 1 dong lich su hoat dong. Dung chung cho Task, Project... o cac module khac. */
export function logActivity(input: LogActivityInput) {
  return prisma.activityLog.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      oldValue: input.oldValue ?? null,
      newValue: input.newValue ?? null,
      actorId: input.actorId,
    },
  });
}

export async function listActivityLogs(entityType: string, entityId: string) {
  return prisma.activityLog.findMany({
    where: { entityType, entityId, deletedAt: null },
    include: {
      actor: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}
