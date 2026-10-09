import { z } from 'zod';
import { PROPOSE_BOARD_PATCH_PROVIDER_SCHEMA, proposeBoardPatchSchema } from './actions/actions.patch.schema';
import { PROPOSE_ACTIONS_PROVIDER_SCHEMA, proposeActionsSchema } from './actions/actions.schema';
import { TOOL_SCHEMAS } from './chat.v2.schema';
import { TOOL_DESCRIPTIONS } from './chat.v2.tools';

export const finishSchema = z.object({ sourceIds: z.array(z.string().uuid()).max(8), comment: z.string().trim().min(1).max(300).optional() }).strict();
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
      : name === 'finish' ? 'Kết thúc khi đã truy vấn đủ mọi phần. sourceIds là nguồn kết quả thành công. comment (tùy chọn): nhận xét 1-2 câu; số viết bằng chữ số và phải có trong kết quả; không dùng % / phần trăm / số viết bằng chữ / tên riêng.'
      : name === 'clarify' ? 'Hỏi làm rõ trước khi truy vấn nếu thiếu thời gian hoặc nghĩa của bộ lọc.'
      : 'Giải thích giới hạn nếu không có công cụ đọc phù hợp. Không thực hiện thao tác ghi.',
    parameters,
  },
  });
});

// Cong cu GHI duy nhat (Phase 1 mot thao tac, Phase 2 nhieu thao tac). KHONG nam trong MODEL_SCHEMAS / modelTools: chi duoc gui cho LLM khi CHAT_ACTIONS bat, co AI va
// nguoi dung sua duoc (xem chat.v2.service). Luoc do gui di la ban VIET TAY phang (khong sinh tu Zod vi preprocess + union object);
// Zod ben server (`proposeActionsSchema`, .strict()) van la nguon su that: khoa la nhu cardId / boardId bi tu choi.
export const PROPOSE_TOOL = 'propose_actions';
export const proposeActionsTool = {
  type: 'function',
  function: {
    name: PROPOSE_TOOL,
    description:
      'Đề xuất các thay đổi dữ liệu (1-15 thao tác, CÙNG MỘT bảng) theo lệnh của người dùng: CREATE_LIST, CREATE_CARD, RENAME_CARD, SET_CARD_DUE, MOVE_CARD, SET_CARD_STATUS, ASSIGN_MEMBER, ADD_LABEL, ASSIGN_UNASSIGNED (chia việc chưa có người trong một cột). Dùng tham chiếu tượng trưng (TEXT/CONTEXT/SELF/PLAN; member còn có BEST = người phù hợp nhất do server chọn), KHÔNG điền id; cột/thẻ do chính lệnh tạo ra thì đặt key rồi tham chiếu {by:PLAN,key}. Đây là lệnh kết thúc: backend tự tìm đối tượng, kiểm quyền rồi tự chạy (một thao tác an toàn) hoặc hiện bản xem trước.',
    parameters: PROPOSE_ACTIONS_PROVIDER_SCHEMA,
  },
} as const;
// Cong cu GHI thu hai (Phase 3): AI mo rong bang. Mo hinh chi khai muc tieu; noi dung do bo lap ke hoach rieng cua server sinh ra (khong co cong cu).
export const PATCH_TOOL = 'propose_board_patch';
export const proposeBoardPatchTool = {
  type: 'function',
  function: {
    name: PATCH_TOOL,
    description:
      'Mở rộng bảng đang mở bằng cột/thẻ MỚI do AI nghĩ ra, khi người dùng chỉ nêu mục tiêu hoặc chủ đề và nhờ trợ lý đề xuất thêm (vd "bổ sung các việc còn thiếu cho giai đoạn kiểm thử", "lên danh sách việc cho tính năng thanh toán"), KHÔNG tự liệt kê tên cột/thẻ. Chỉ THÊM cột/thẻ, không xóa hay sửa dữ liệu cũ. Đây là lệnh kết thúc: backend tự đọc bảng, lập đề xuất, lọc trùng rồi hiện bản xem trước (luôn phải bấm Áp dụng).',
    parameters: PROPOSE_BOARD_PATCH_PROVIDER_SCHEMA,
  },
} as const;
export const ACTION_MODEL_SCHEMAS = { [PROPOSE_TOOL]: proposeActionsSchema, [PATCH_TOOL]: proposeBoardPatchSchema } as const;

export interface ModelCall { id: string; name: string; arguments: unknown }
const plannerCall = (names: [string, ...string[]]) => z.object({ name: z.enum(names), arguments: z.record(z.string(), z.unknown()) }).strict();
const READ_TOOL_NAMES = Object.keys(MODEL_SCHEMAS) as [keyof typeof MODEL_SCHEMAS, ...Array<keyof typeof MODEL_SCHEMAS>];
export const plannerSchema = z.object({ calls: z.array(plannerCall(READ_TOOL_NAMES)).min(1).max(8) }).strict();
/** Ban du phong JSON khi cho phep cong cu ghi: cung hinh dang, them ten `propose_actions`. */
export const plannerSchemaWithActions = z.object({ calls: z.array(plannerCall([...READ_TOOL_NAMES, PROPOSE_TOOL, PATCH_TOOL])).min(1).max(8) }).strict();
