import { prisma } from '../../../config/prisma';
import { AppError } from '../../../utils/AppError';
import { chatScopeSchema } from '../chat.schema';
import { resolveScope, loadRoster, type ChatScopeInput, type ResolvedScope } from '../chat.scope';
import type { RosterMember } from '../chat.members';

/** Server-owned context. No roles, names or saved permissions are accepted from tool inputs. */
export interface ToolContext {
  userId: string;
  now: Date;
  scope: ChatScopeInput;
  conversationScope?: ChatScopeInput;
}
export interface ExecutionContext {
  scope: ResolvedScope;
  scopeInput: ChatScopeInput;
  now: Date;
  roster: RosterMember[];
}
/** The future session layer calls this when the UI scope changes. Keep only server-owned identity/time. */
export function withUiScope(ctx: ToolContext, next: ChatScopeInput): ToolContext {
  const scope = chatScopeSchema.parse(next);
  const changed = JSON.stringify(scope) !== JSON.stringify(chatScopeSchema.parse(ctx.scope));
  return { ...ctx, scope, conversationScope: changed ? undefined : ctx.conversationScope };
}
async function accessibleRoster(scope: ResolvedScope): Promise<RosterMember[]> {
  if (scope.kind !== 'MY') return loadRoster(scope);
  const boards = await prisma.board.findMany({
    where: scope.boardWhere,
    select: {
      ownerId: true, visibility: true,
      members: { where: { deletedAt: null }, select: { userId: true } },
      workspace: { select: { ownerId: true, members: { where: { deletedAt: null }, select: { userId: true } } } },
    },
  });
  const ids = new Set<string>([scope.userId]);
  for (const b of boards) {
    ids.add(b.ownerId);
    for (const m of b.members) ids.add(m.userId);
    if (b.visibility === 'WORKSPACE') {
      ids.add(b.workspace.ownerId);
      for (const m of b.workspace.members) ids.add(m.userId);
    }
  }
  return (await prisma.user.findMany({ where: { id: { in: [...ids] }, deletedAt: null }, select: { id: true, name: true } }))
    .map((u) => ({ userId: u.id, name: u.name }));
}
export async function resolveExecutionContext(ctx: ToolContext, explicit?: ChatScopeInput): Promise<ExecutionContext> {
  if (!Number.isFinite(ctx.now.getTime())) throw new AppError('Thời điểm truy vấn không hợp lệ', 400);
  const active = await prisma.user.count({ where: { id: ctx.userId, deletedAt: null } });
  if (!active) throw new AppError('Phiên người dùng không hợp lệ', 401);
  const scopeInput = chatScopeSchema.parse(explicit ?? ctx.conversationScope ?? ctx.scope);
  const scope = await resolveScope(ctx.userId, scopeInput);
  // Do not include boards left behind by a soft-deleted workspace.
  scope.boardWhere = { AND: [scope.boardWhere, { workspace: { deletedAt: null } }] };
  scope.boardCount = await prisma.board.count({ where: scope.boardWhere });
  if (scope.kind === 'BOARD' && scope.boardCount === 0) throw new AppError('Không tìm thấy bảng trong phạm vi được phép', 403);
  return { scope, scopeInput, now: new Date(ctx.now), roster: await accessibleRoster(scope) };
}
export function assertRosterIds(ids: readonly string[] | undefined, ctx: ExecutionContext): void {
  if (!ids) return;
  const allowed = new Set(ctx.roster.map((m) => m.userId));
  if (ids.some((id) => !allowed.has(id))) throw new AppError('Không tìm thấy thành viên trong phạm vi được phép', 400);
}
