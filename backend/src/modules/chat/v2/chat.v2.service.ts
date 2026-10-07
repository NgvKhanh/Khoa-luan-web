import { z } from 'zod';
import { AppError } from '../../../utils/AppError';
import { handleMessage, handleChoice, handleMore, understandByRules, type ChatReply } from '../chat.service';
import { chatSessions } from '../chat.session';
import type { ChatMessageInput } from '../chat.schema';
import { basicStep, bindEntity, explicitBoardName, orchestrate, validateBindings } from './chat.v2.orchestrator';
import { callChatModel, v2LlmAvailable, type ModelStep } from './chat.v2.llm';
import { v2Sessions, type V2Session, type V2SessionStore } from './chat.v2.session';
import { v2Reply, resultBlock } from './chat.v2.answer';
import { executeChatTool } from './chat.v2.tools';
import { resolveExecutionContext } from './chat.v2.scope';
import { v2ChoiceSchema, v2MoreSchema, type V2Reply } from './chat.v2.contract';

export interface V2ServiceContext { now: Date; sessions?: V2SessionStore; step?: ModelStep; available?: boolean }
function legacyReply(s: V2Session, reply: ChatReply): V2Reply {
  s.legacyId = reply.conversationId;
  s.legacyOptions = reply.answer.clarify?.options.map((o) => ({ id: o.id, kind: o.kind }));
  return { ...reply, conversationId: s.id, version: 'v2', mode: 'BASIC', understood: { ...reply.understood, summary: 'Tra cứu bằng chế độ cơ bản' } };
}
async function answerQuestion(s: V2Session, message: string, context: V2ServiceContext): Promise<V2Reply> {
  const { now } = context;
  const step = context.step ?? callChatModel;
  const basic = basicStep(message, now);
  const available = context.available ?? v2LlmAvailable();
  s.legacyOptions = undefined;
  const folded = message.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');
  const writeRequest = /^(?:hay |vui long |toi muon |toi can )?(?:tao |xoa |sua |doi han |giao viec |phan cong |chuyen |luu tru )/.test(folded)
    || /(?:tao|xoa|sua|doi han|giao viec|phan cong|chuyen).*(?:giup toi|giup minh|gium|ho toi)/.test(folded);
  if (writeRequest) {
    s.pending = undefined; s.queries = []; s.legacyId = undefined;
    return v2Reply(s, now, [], available ? 'AI' : 'BASIC', 'Trợ lý hiện chỉ đọc dữ liệu. Bạn cần thực hiện tạo, sửa hoặc giao việc trực tiếp trên website.');
  }
  const namedBoard = explicitBoardName(message);
  if (namedBoard && !s.bindings.some((b) => b.kind === 'BOARD' && b.name === namedBoard)) {
    const resolveInput = { kind: 'BOARD', text: namedBoard };
    const found = await executeChatTool({ userId: s.userId, now, scope: s.uiScope }, 'resolve_entities', resolveInput);
    if (found.data.status === 'NOT_FOUND') { s.pending = undefined; s.queries = []; return v2Reply(s, now, [], available ? 'AI' : 'BASIC', 'Không tìm thấy bảng này trong dữ liệu bạn được phép xem.'); }
    if (found.data.status === 'CLARIFY') {
      s.queries = []; s.pending = { kind: 'ENTITY', original: message, question: 'Có nhiều bảng cùng tên. Bạn muốn chọn bảng nào?', options: found.data.options, resolveInput };
      return v2Reply(s, now, [], available ? 'AI' : 'BASIC', s.pending.question);
    }
    bindEntity(s, found.data.options[0]);
  }
  const historyQuestion = /(?:thay doi|da doi|doi han|nhat ky|lich su)/.test(folded);
  const hasHistoryTime = /(?:hom nay|hom qua|tuan|thang|gan day|\bngay\b|\d{1,4}[/-]\d{1,2}|\bvua\b)/.test(folded);
  if (historyQuestion && !hasHistoryTime) {
    s.queries = []; s.pending = { kind: 'QUESTION', original: message, question: 'Bạn muốn xem thay đổi trong khoảng thời gian nào? Ví dụ: hôm nay hoặc tuần này.', options: [] };
    return v2Reply(s, now, [], available ? 'AI' : 'BASIC', s.pending.question);
  }
  if (available) {
    const response = await orchestrate(s, message, now, step);
    if (response.mode !== 'BASIC') { s.legacyId = undefined; return response; }
  }
  if (basic) { s.legacyId = undefined; return orchestrate(s, message, now, basic, 'BASIC'); }
  if (historyQuestion || /(?:\bva\b|phan cong|chua giao|\bgan\b)/.test(folded)) return v2Reply(s, now, [], 'BASIC', 'AI hiện chưa sẵn sàng để xử lý đầy đủ câu này. Hãy thử lại hoặc tách câu hỏi thành từng phần.');
  await validateBindings(s, now);
  const reply = await handleMessage(s.userId, { message, scope: s.scope ?? s.uiScope, conversationId: s.legacyId }, { now, sessions: chatSessions, understand: understandByRules });
  s.lastQuestion = message;
  return legacyReply(s, reply);
}
export async function handleV2Message(userId: string, input: ChatMessageInput, context: V2ServiceContext): Promise<V2Reply> {
  const store = context.sessions ?? v2Sessions;
  let s = store.get(userId, input.conversationId, context.now);
  const reset = !!input.conversationId && !s;
  if (!s) s = store.create(userId, input.scope, context.now);
  if (JSON.stringify(s.uiScope) !== JSON.stringify(input.scope)) {
    s.uiScope = input.scope; s.scope = undefined; s.bindings = []; s.queries = []; s.pending = undefined;
    s.lastQuestion = undefined; s.legacyId = undefined; s.legacyOptions = undefined;
  }
  await resolveExecutionContext({ userId, now: context.now, scope: input.scope });
  const message = s.pending?.kind === 'QUESTION' ? `${s.pending.original}\nBổ sung: ${input.message}` : input.message;
  const reply = await answerQuestion(s, message, context);
  if (reset) reply.conversationReset = true;
  return reply;
}
export async function handleV2Choice(userId: string, input: z.infer<typeof v2ChoiceSchema>, context: V2ServiceContext): Promise<V2Reply> {
  const s = (context.sessions ?? v2Sessions).require(userId, input.conversationId, context.now);
  await validateBindings(s, context.now);
  if (s.legacyOptions && s.legacyId) {
    const o = s.legacyOptions.find((o) => o.id === input.optionId);
    if (!o) throw new AppError('Lựa chọn không hợp lệ', 400);
    const selected = o.kind === 'USER' ? { userId: o.id } : o.kind === 'WORKSPACE' ? { workspaceId: o.id } : { targetId: o.id };
    return legacyReply(s, await handleChoice(userId, { conversationId: s.legacyId, ...selected }, { now: context.now, sessions: chatSessions }));
  }
  const pending = s.pending;
  if (!pending || pending.kind !== 'ENTITY' || !pending.resolveInput) throw new AppError('Không có lựa chọn đang chờ', 400);
  if (!pending.options.some((o) => o.id === input.optionId)) throw new AppError('Lựa chọn không hợp lệ', 400);
  const result = await executeChatTool({ userId, now: context.now, scope: s.uiScope, conversationScope: s.scope }, 'resolve_entities', pending.resolveInput);
  const option = result.data.options.find((o) => o.id === input.optionId);
  if (!option) throw new AppError('Đối tượng không còn được phép xem', 403);
  bindEntity(s, option);
  s.pending = undefined;
  return answerQuestion(s, pending.original, context);
}
export async function handleV2More(userId: string, input: z.infer<typeof v2MoreSchema>, context: V2ServiceContext): Promise<V2Reply> {
  const s = (context.sessions ?? v2Sessions).require(userId, input.conversationId, context.now);
  if (!input.blockId && s.legacyId && !s.queries.length) return legacyReply(s, await handleMore(userId, { conversationId: s.legacyId, page: input.page }, { now: context.now, sessions: chatSessions }));
  const saved = s.queries.find((q) => q.blockId === input.blockId);
  if (!saved || !saved.hasMore || input.page !== saved.page + 1) throw new AppError('Phần trả lời hoặc trang không hợp lệ', 400);
  const result = await executeChatTool({ userId, now: context.now, scope: s.uiScope }, saved.tool, { ...saved.input, page: input.page });
  const block = resultBlock(result, saved.blockId);
  saved.page = input.page;
  saved.hasMore = block.status === 'OK' && block.pagination.hasMore;
  return v2Reply(s, context.now, [block], 'BASIC');
}
