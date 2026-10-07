import { randomUUID } from 'node:crypto';
import type { V2Block, V2Reply } from './chat.v2.contract';
import type { ToolResult } from './chat.v2.tools';
import type { V2Session } from './chat.v2.session';
import type { ActionView } from './actions/actions.types';

export function resultBlock(result: ToolResult, id: string = randomUUID()): V2Block {
  const { tool, data, source } = result;
  if (tool === 'resolve_entities') throw new Error('Entity results are not answer blocks');
  const input = source.appliedInput;
  const filters = input.filters as Record<string, unknown> | undefined;
  const title = tool === 'query_tasks'
    ? filters?.assignment === 'UNASSIGNED' ? 'Công việc chưa được phân công' : filters?.assignment === 'ASSIGNED' ? 'Công việc đã được phân công' : 'Danh sách công việc'
    : tool === 'aggregate_tasks' ? 'Thống kê công việc'
    : tool === 'query_activities' ? 'Lịch sử thay đổi' : tool === 'query_catalog' && 'kind' in data && data.kind === 'MEMBERS' ? 'Danh sách thành viên' : 'Danh mục';
  const paged = data as { page: number; hasMore: boolean };
  return { id, title, status: 'OK', tool, source, data, pagination: { page: paged.page, hasMore: paged.hasMore } } as V2Block;
}
export function errorBlock(title: string, error: string): V2Block { return { id: randomUUID(), title, status: 'ERROR', error }; }
export function v2Reply(session: V2Session, now: Date, blocks: V2Block[], mode: V2Reply['mode'], text?: string, notes: string[] = [], extra: { action?: ActionView } = {}): V2Reply {
  const ok = blocks.filter((b) => b.status === 'OK');
  const labels = [...new Set(ok.map((b) => b.source.scopeLabel))];
  return {
    version: 'v2', mode, conversationId: session.id,
    understood: { intent: 'NONE', period: null, focus: null, memberName: null, parser: mode === 'AI' ? 'LLM' : 'RULE', summary: ok.map((b) => b.title).join(' · ') || (extra.action ? 'Thao tác trên bảng' : 'Tra cứu dữ liệu') },
    answer: { kind: session.pending ? 'CLARIFY' : ok.length || extra.action ? 'ANSWER' : 'UNSUPPORTED',
      text: text ?? (ok.length ? 'Kết quả từ dữ liệu bạn được phép xem:' : 'Chưa thể trả lời đầy đủ câu hỏi này.'),
      scopeLabel: labels.join(' · '), generatedAt: now.toISOString(), blocks,
      facts: [], cards: [], total: 0, page: 1, pageSize: 20, sections: [], ignoredSlots: [], notes,
      suggestions: [], ...(extra.action ? { action: extra.action } : {}), ...(session.pending ? { clarify: { question: session.pending.question,
        options: session.pending.options.map((o) => ({ id: o.id, label: o.parentName ? `${o.name} · ${o.parentName}` : o.name, kind: 'TARGET' as const })) } } : {}),
    },
  };
}
