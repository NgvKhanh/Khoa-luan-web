import { z } from 'zod';
import { TOOL_SCHEMAS } from './chat.v2.schema';
import { TOOL_DESCRIPTIONS } from './chat.v2.tools';

export const finishSchema = z.object({ sourceIds: z.array(z.string().uuid()).max(8) }).strict();
export const clarifySchema = z.object({ question: z.string().min(1).max(300) }).strict();
export const unsupportedSchema = z.object({ reason: z.string().min(1).max(300) }).strict();
export const MODEL_SCHEMAS = { ...TOOL_SCHEMAS, finish: finishSchema, clarify: clarifySchema, unsupported: unsupportedSchema };
// Provider schema hints are deliberately simpler than validation. Zod remains authoritative.
// Gemini's compatible endpoint rejects some draft-2020 keywords (notably oneOf/const).
function providerSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(providerSchema);
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (['$schema', 'default', 'pattern', 'format', 'additionalProperties'].includes(key)) continue;
    if (key === 'const') result.enum = [v];
    else result[key === 'oneOf' ? 'anyOf' : key] = providerSchema(v);
  }
  if (Array.isArray(result.anyOf) && result.anyOf.every((v: { type?: string; enum?: unknown }) => v.type === 'string' && !v.enum)) {
    delete result.anyOf; result.type = 'string'; result.description = 'YYYY-MM-DD hoặc ISO timestamp có múi giờ';
  }
  if (Array.isArray(result.anyOf) && result.anyOf.every((v: { type?: string }) => v.type === 'object')) {
    // Scope discriminators stay strict on the server. A flat hint avoids provider grammar
    // expansion across the same union in every function declaration.
    return { type: 'object', properties: { kind: { type: 'string', enum: ['MY', 'WORKSPACE', 'BOARD'] },
      boardId: { type: 'string' }, workspaceId: { type: 'string' } }, required: ['kind'],
      description: 'MY: chỉ kind; BOARD: kind và boardId; WORKSPACE: kind và workspaceId. Không gửi khóa thừa.' };
  }
  return result;
}
export const modelTools = Object.entries(MODEL_SCHEMAS).map(([name, schema]) => {
  const parameters = providerSchema(z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })) as Record<string, unknown>;
  if (name === 'query_activities') {
    // Nested history is rejected by this tool's Zod refinement; do not advertise it.
    const props = parameters.properties as Record<string, { properties?: Record<string, unknown> }>;
    if (props.taskFilters?.properties) delete props.taskFilters.properties.changed;
  }
  return ({
  type: 'function', function: { name,
    description: name in TOOL_DESCRIPTIONS ? TOOL_DESCRIPTIONS[name as keyof typeof TOOL_DESCRIPTIONS]
      : name === 'finish' ? 'Kết thúc khi đã truy vấn đủ mọi phần. sourceIds là nguồn kết quả thành công.'
      : name === 'clarify' ? 'Hỏi làm rõ trước khi truy vấn nếu thiếu thời gian hoặc nghĩa của bộ lọc.'
      : 'Giải thích giới hạn nếu không có công cụ đọc phù hợp. Không thực hiện thao tác ghi.',
    parameters,
  },
  });
});
export interface ModelCall { id: string; name: string; arguments: unknown }
export const plannerSchema = z.object({ calls: z.array(z.object({ name: z.enum(Object.keys(MODEL_SCHEMAS) as [keyof typeof MODEL_SCHEMAS, ...Array<keyof typeof MODEL_SCHEMAS>]), arguments: z.record(z.string(), z.unknown()) }).strict()).min(1).max(8) }).strict();
