import { z } from 'zod';
import { chatScopeSchema } from '../chat.schema';
import type { ChatReply } from '../chat.service';
import type { ToolDataMap, ToolResult } from './chat.v2.tools';
import type { ToolName } from './chat.v2.schema';

const uuid = z.string().uuid();
export const v2ChoiceSchema = z.object({ conversationId: uuid, optionId: z.string().min(1).max(128) }).strict();
export const v2MoreSchema = z.object({ conversationId: uuid, blockId: uuid.optional(), page: z.number().int().min(2).max(1000) }).strict();
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
  answer: ChatReply['answer'] & { blocks?: V2Block[] };
};
