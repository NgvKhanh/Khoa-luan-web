import { z } from 'zod';
import { chatScopeSchema } from '../chat.schema';
import type { ChatReply } from '../chat.service';
import type { ActionView } from './actions/actions.types';
import type { ToolDataMap, ToolResult } from './chat.v2.tools';
import type { ToolName } from './chat.v2.schema';

const uuid = z.string().uuid();
// `scope` (tuỳ chọn): phạm vi giao diện HIỆN TẠI. Có thì backend đối chiếu với phạm vi hội thoại đã lưu - nút cũ của trang khác không còn tác dụng.
export const v2ChoiceSchema = z.object({ conversationId: uuid, optionId: z.string().min(1).max(128), scope: chatScopeSchema.optional() }).strict();
export const v2MoreSchema = z.object({ conversationId: uuid, blockId: uuid.optional(), page: z.number().int().min(2).max(1000), scope: chatScopeSchema.optional() }).strict();
// Hanh dong (Phase 1): xac nhan = checksum cua ban xem truoc + pham vi giao dien HIEN TAI (ke hoach cua bang khac bi huy).
export const v2ConfirmSchema = z.object({ conversationId: uuid, checksum: z.string().regex(/^[0-9a-f]{64}$/), scope: chatScopeSchema }).strict();
export const v2CancelSchema = z.object({ conversationId: uuid }).strict();
export const v2PlanIdSchema = uuid;
export const v2MessageSchema = z.object({ message: z.string().trim().min(1).max(500), scope: chatScopeSchema, conversationId: uuid.optional() }).strict();
export type V2Block = {
  [K in Exclude<ToolName, 'resolve_entities'>]: {
    id: string; title: string; status: 'OK'; tool: K; source: ToolResult['source']; data: ToolDataMap[K];
    pagination: { page: number; hasMore: boolean };
  }
}[Exclude<ToolName, 'resolve_entities'>] | { id: string; title: string; status: 'ERROR'; error: string };
export type V2Reply = Omit<ChatReply, 'understood' | 'answer'> & {
  version: 'v2'; mode: 'AI' | 'BASIC';
  understood: ChatReply['understood'] & { summary: string };
  // `action`: ban xem truoc hoac ket qua cua MOT thao tac (khong nam trong blocks de khong lam vo code gia dinh khoi la khoi doc).
  answer: ChatReply['answer'] & { blocks?: V2Block[]; action?: ActionView };
};
