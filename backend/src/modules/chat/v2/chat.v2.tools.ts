import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { AppError } from '../../../utils/AppError';
import { resolveExecutionContext, type ToolContext, type ExecutionContext } from './chat.v2.scope';
import { resolveEntities } from './chat.v2.entities';
import { TOOL_SCHEMAS, type ToolName } from './chat.v2.schema';
import { normalizeRange } from './chat.v2.dates';
import { queryTasks } from './tools/queryTasks';
import { aggregateTasks } from './tools/aggregateTasks';
import { queryActivities } from './tools/queryActivities';
import { queryCatalog } from './tools/queryCatalog';
import { TOOL_OUTPUT_SCHEMAS } from './chat.v2.output';

export type ToolData =
  | Awaited<ReturnType<typeof resolveEntities>> | Awaited<ReturnType<typeof queryTasks>>
  | Awaited<ReturnType<typeof aggregateTasks>> | Awaited<ReturnType<typeof queryActivities>>
  | Awaited<ReturnType<typeof queryCatalog>>;
export interface ToolDataMap {
  resolve_entities: Awaited<ReturnType<typeof resolveEntities>>;
  query_catalog: Awaited<ReturnType<typeof queryCatalog>>;
  query_tasks: Awaited<ReturnType<typeof queryTasks>>;
  aggregate_tasks: Awaited<ReturnType<typeof aggregateTasks>>;
  query_activities: Awaited<ReturnType<typeof queryActivities>>;
}
export interface ToolResult<T extends ToolData = ToolData> {
  tool: ToolName;
  source: {
    id: string; generatedAt: string; scope: ExecutionContext['scopeInput']; scopeLabel: string;
    appliedInput: Record<string, unknown>; ranges: { from: string; to: string }[];
  };
  data: T;
}
export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  resolve_entities: 'Tìm bảng, không gian, công việc, cột hoặc thành viên có quyền xem; trả lựa chọn khi trùng tên.',
  query_catalog: 'Danh sách bảng, không gian và thành viên trong phạm vi có quyền xem, có phân trang.',
  query_tasks: 'Lọc công việc theo trạng thái, người, chưa giao, nhãn, ngày và lịch sử; trả tổng số và danh sách.',
  aggregate_tasks: 'Đếm toàn bộ công việc đã lọc, nhóm theo người, bảng, cột, trạng thái hoặc ngày; giữ đồng hạng.',
  query_activities: 'Tra nhật ký trong khoảng thời gian; trả sự kiện hoặc công việc duy nhất có thay đổi, có thể lọc theo trạng thái hiện tại.',
};
function envelope<T extends ToolData>(name: ToolName, ctx: ExecutionContext, input: object, data: T): ToolResult<T> {
  const checked = TOOL_OUTPUT_SCHEMAS[name].safeParse(data);
  if (!checked.success) throw new Error(`Invalid v2 output for ${name}`);
  // Normalize every range recorded in the evidence (including nested task/history filters).
  const ranges: { from: string; to: string }[] = [];
  function visit(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    const object = value as Record<string, unknown>;
    if (typeof object.from === 'string' && typeof object.to === 'string') {
      const range = normalizeRange({ from: object.from, to: object.to });
      ranges.push({ from: range.from.toISOString(), to: range.to.toISOString() });
    } else for (const child of Object.values(object)) visit(child);
  }
  visit(input);
  return {
    tool: name,
    source: { id: randomUUID(), generatedAt: ctx.now.toISOString(), scope: ctx.scopeInput,
      scopeLabel: ctx.scope.board?.name ?? ctx.scope.workspace?.name ?? 'Các bảng bạn được phép xem', appliedInput: { ...input }, ranges },
    data,
  };
}
/** Only entry point for v2 tools. The orchestrator owns LLM calls and HTTP sessions. */
export function executeChatTool<K extends ToolName>(ctx: ToolContext, name: K, raw: unknown): Promise<ToolResult<ToolDataMap[K]>>;
export async function executeChatTool(ctx: ToolContext, name: ToolName, raw: unknown): Promise<ToolResult> {
  if (!Object.hasOwn(TOOL_SCHEMAS, name)) throw new AppError('Công cụ không được hỗ trợ', 400);
  try {
    switch (name) {
      case 'resolve_entities': {
        const input = TOOL_SCHEMAS[name].parse(raw);
        // Explicit entity names for boards/spaces search across allowed scopes, rather than being trapped in the UI board.
        const scope = input.scope ?? (input.kind === 'BOARD' || input.kind === 'WORKSPACE' ? { kind: 'MY' as const } : undefined);
        const exec = await resolveExecutionContext(ctx, scope);
        return envelope(name, exec, input, await resolveEntities(exec, input.kind, input.text));
      }
      case 'query_catalog': {
        const input = TOOL_SCHEMAS[name].parse(raw); const exec = await resolveExecutionContext(ctx, input.scope);
        return envelope(name, exec, input, await queryCatalog(exec, input));
      }
      case 'query_tasks': {
        const input = TOOL_SCHEMAS[name].parse(raw); const exec = await resolveExecutionContext(ctx, input.scope);
        return envelope(name, exec, input, await queryTasks(exec, input));
      }
      case 'aggregate_tasks': {
        const input = TOOL_SCHEMAS[name].parse(raw); const exec = await resolveExecutionContext(ctx, input.scope);
        return envelope(name, exec, input, await aggregateTasks(exec, input));
      }
      case 'query_activities': {
        const input = TOOL_SCHEMAS[name].parse(raw); const exec = await resolveExecutionContext(ctx, input.scope);
        return envelope(name, exec, input, await queryActivities(exec, input));
      }
    }
  } catch (error) {
    if (error instanceof z.ZodError) throw new AppError('Tham số công cụ không hợp lệ', 400);
    throw error;
  }
}
