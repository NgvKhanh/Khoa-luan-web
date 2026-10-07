// Luu tru ke hoach (bang ChatActionPlan): tao, nhan cho NGUYEN TU, huy, het han (CHATBOT_V2_ACTIONS_PLAN.md §10).
//
// "Nhan cho" la `updateMany ... WHERE status = 'PROPOSED'`: hai yeu cau xac nhan dong thoi (bam dup, hai tab, hai tien trinh) chi co
// MOT yeu cau thang - cung ky thuat claim cua ai.apply.ts (appliedAt = null). Moi ham nhan `userId`: ke hoach cua nguoi khac
// khong bao gio doc / sua duoc qua day.

import { prisma } from '../../../../config/prisma';
import type { Prisma } from '../../../../generated/prisma/client';
import { PLAN_TTL_MS } from './actions.plan';
import type { ActionErrorCode, ConfirmReason, PlanRisk, PlanStatus, Provenance, StoredPlan } from './actions.types';

export type PlanRow = Prisma.ChatActionPlanGetPayload<Record<string, never>>;

const json = (value: unknown): Prisma.InputJsonValue => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;

export interface NewPlan {
  userId: string;
  conversationId: string;
  boardId: string | null;
  scopeKind: 'MY' | 'BOARD' | 'WORKSPACE';
  prompt: string;
  /** StoredPlan, hoac ban ghi toi thieu cua mot lan tu choi. */
  plan: StoredPlan | Record<string, unknown>;
  checksum: string;
  risk: PlanRisk;
  requiresConfirmation: boolean;
  reasons: readonly ConfirmReason[];
  provenance: Provenance;
  status: PlanStatus;
  autoExecuted?: boolean;
  errorCode?: ActionErrorCode;
  now: Date;
  meta: { provider: string; model: string; adapter: string; promptTokens: number | null; completionTokens: number | null; latencyMs: number | null };
}

export async function createPlanRow(input: NewPlan): Promise<PlanRow> {
  return prisma.chatActionPlan.create({
    data: {
      userId: input.userId,
      actorKey: input.userId,
      conversationId: input.conversationId,
      boardId: input.boardId,
      scopeKind: input.scopeKind,
      prompt: input.prompt.slice(0, 500),
      plan: json(input.plan),
      checksum: input.checksum,
      risk: input.risk,
      requiresConfirmation: input.requiresConfirmation,
      reasons: json(input.reasons),
      provenance: input.provenance,
      status: input.status,
      autoExecuted: input.autoExecuted ?? false,
      provider: input.meta.provider,
      model: input.meta.model,
      adapter: input.meta.adapter,
      promptTokens: input.meta.promptTokens,
      completionTokens: input.meta.completionTokens,
      latencyMs: input.meta.latencyMs,
      errorCode: input.errorCode ?? null,
      createdAt: input.now,
      expiresAt: new Date(input.now.getTime() + PLAN_TTL_MS),
      ...(input.status === 'FAILED' ? { decidedAt: input.now } : {}),
    },
  });
}

/**
 * Ghi de MOT ke hoach dang do (NEEDS_CHOICE -> da chon xong) bang noi dung moi, giu nguyen id va nguoi so huu, gia han 10 phut
 * (nguoi dung can du thoi gian doc ban xem truoc). Chi cap nhat khi ke hoach van dang cho chon: neu da bi huy / het han giua
 * chung thi tra null va nguoi goi khong duoc tiep tuc.
 */
export async function replacePlan(planId: string, input: NewPlan): Promise<PlanRow | null> {
  const res = await prisma.chatActionPlan.updateMany({
    where: { id: planId, userId: input.userId, status: 'NEEDS_CHOICE', expiresAt: { gt: input.now } },
    data: {
      boardId: input.boardId,
      plan: json(input.plan),
      checksum: input.checksum,
      risk: input.risk,
      requiresConfirmation: input.requiresConfirmation,
      reasons: json(input.reasons),
      provenance: input.provenance,
      status: input.status,
      autoExecuted: input.autoExecuted ?? false,
      errorCode: input.errorCode ?? null,
      expiresAt: new Date(input.now.getTime() + PLAN_TTL_MS),
      ...(input.status === 'FAILED' ? { decidedAt: input.now } : {}),
    },
  });
  return res.count === 1 ? prisma.chatActionPlan.findUnique({ where: { id: planId } }) : null;
}

/** Ke hoach CUA CHINH NGUOI NAY (nguoi khac -> null, khong lo la co ton tai). */
export async function findOwnedPlan(userId: string, planId: string): Promise<PlanRow | null> {
  return prisma.chatActionPlan.findFirst({ where: { id: planId, userId } });
}

/** Ke hoach moi nhat cua hoi thoai con DANG MO (cho xac nhan / cho chon) va con han. */
export async function findOpenPlan(userId: string, conversationId: string, now: Date): Promise<PlanRow | null> {
  return prisma.chatActionPlan.findFirst({
    where: { userId, conversationId, status: { in: ['PROPOSED', 'NEEDS_CHOICE'] }, expiresAt: { gt: now } },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

export async function updatePlan(planId: string, data: Prisma.ChatActionPlanUncheckedUpdateInput): Promise<PlanRow> {
  return prisma.chatActionPlan.update({ where: { id: planId }, data });
}

/** PROPOSED -> EXECUTING nguyen tu va con han. true = minh thang cuoc dua. */
export async function claimPlan(planId: string, userId: string, now: Date): Promise<boolean> {
  const res = await prisma.chatActionPlan.updateMany({
    where: { id: planId, userId, status: 'PROPOSED', expiresAt: { gt: now } },
    data: { status: 'EXECUTING', decidedAt: now },
  });
  return res.count === 1;
}

/** Ke hoach dang cho (PROPOSED / NEEDS_CHOICE) da qua han -> EXPIRED (danh dau khi cham toi). */
export async function expireIfNeeded(row: PlanRow, now: Date): Promise<PlanRow> {
  if ((row.status === 'PROPOSED' || row.status === 'NEEDS_CHOICE') && row.expiresAt.getTime() <= now.getTime()) {
    const res = await prisma.chatActionPlan.updateMany({
      where: { id: row.id, status: row.status },
      data: { status: 'EXPIRED', errorCode: 'EXPIRED', decidedAt: now },
    });
    if (res.count === 1) return { ...row, status: 'EXPIRED', errorCode: 'EXPIRED', decidedAt: now };
    return (await prisma.chatActionPlan.findUnique({ where: { id: row.id } })) ?? row;
  }
  return row;
}

/** Huy moi ke hoach DANG MO (cho xac nhan / cho chon) cua hoi thoai. `except` = ke hoach vua tao, giu lai. */
export async function cancelOpenPlans(
  userId: string,
  conversationId: string,
  reason: ActionErrorCode,
  now: Date,
  opts: { except?: string; onlyStatuses?: readonly PlanStatus[] } = {}
): Promise<number> {
  const res = await prisma.chatActionPlan.updateMany({
    where: {
      userId,
      conversationId,
      status: { in: [...(opts.onlyStatuses ?? ['PROPOSED', 'NEEDS_CHOICE'])] },
      ...(opts.except !== undefined ? { id: { not: opts.except } } : {}),
    },
    data: { status: 'CANCELLED', errorCode: reason, decidedAt: now },
  });
  return res.count;
}

/** Huy DUNG MOT ke hoach dang mo. true = minh huy duoc (false: da co nguoi / thoi gian quyet dinh truoc). */
export async function cancelPlanRow(planId: string, userId: string, reason: ActionErrorCode | null, now: Date): Promise<boolean> {
  const res = await prisma.chatActionPlan.updateMany({
    where: { id: planId, userId, status: { in: ['PROPOSED', 'NEEDS_CHOICE'] } },
    data: { status: 'CANCELLED', errorCode: reason, decidedAt: now },
  });
  return res.count === 1;
}

/** Trang thai that cua nhieu ke hoach (de phu len ban chup cu khi mo lich su). */
export async function plansByIds(userId: string, ids: readonly string[]): Promise<Map<string, PlanRow>> {
  if (ids.length === 0) return new Map();
  const rows = await prisma.chatActionPlan.findMany({ where: { userId, id: { in: [...ids] } } });
  return new Map(rows.map((r) => [r.id, r]));
}
