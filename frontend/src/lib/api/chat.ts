import { api } from '../axios';
import type { ChatConversationHistory, ChatConversationList, ChatReply, ChatScope, ChatStatus } from '../../types/chat';

// Lop goi API cua tro ly (CHATBOT_MODULE.md §12). Client CHI gui cau hoi, pham vi va ma hoi
// thoai - khong bao gio gui vai tro, danh tinh hay id nguoi duoc nhac (server tu kiem quyen).

// Discover the server-selected engine; availability means configured, not a live key check.
export async function fetchChatStatus(): Promise<ChatStatus> {
  const res = await api.get<{ data: ChatStatus }>('/chat/v2/status');
  return res.data.data;
}

export async function fetchChatConversations(page = 1): Promise<ChatConversationList> {
  const res = await api.get<{ data: ChatConversationList }>('/chat/v2/conversations', { params: { page } });
  return res.data.data;
}
export async function fetchChatConversation(id: string, before?: number): Promise<ChatConversationHistory> {
  const res = await api.get<{ data: ChatConversationHistory }>(`/chat/v2/conversations/${encodeURIComponent(id)}`, { params: before ? { before } : {} });
  return res.data.data;
}

// POST /api/chat/messages - hoi mot cau.
export async function sendChatMessage(input: {
  message: string;
  scope: ChatScope;
  conversationId?: string;
}, engine: 'legacy' | 'v2' = 'legacy'): Promise<ChatReply> {
  const body = {
    message: input.message,
    scope: input.scope,
    ...(input.conversationId ? { conversationId: input.conversationId } : {}),
  };
  const res = await api.post<{ data: ChatReply }>(engine === 'v2' ? '/chat/v2/messages' : '/chat/messages', body);
  return res.data.data;
}

// Answer an entity clarification. v2 may replan with AI after rechecking the chosen entity.
// Gui DUNG MOT trong userId / workspaceId / targetId theo loai lua chon.
export async function sendChatChoice(
  conversationId: string,
  option: { kind: 'USER' | 'WORKSPACE' | 'TARGET'; id: string },
  engine: 'legacy' | 'v2' = 'legacy'
): Promise<ChatReply> {
  const body =
    option.kind === 'USER'
      ? { conversationId, userId: option.id }
      : option.kind === 'WORKSPACE'
        ? { conversationId, workspaceId: option.id }
        : { conversationId, targetId: option.id };
  const res = await api.post<{ data: ChatReply }>(engine === 'v2' ? '/chat/v2/messages/choice' : '/chat/messages/choice', engine === 'v2' ? { conversationId, optionId: option.id } : body);
  return res.data.data;
}

// Next page of a server-owned query (v2: one block). Never calls AI.
export async function fetchMoreAnswer(conversationId: string, page: number, blockId?: string, engine: 'legacy' | 'v2' = 'legacy'): Promise<ChatReply> {
  const res = await api.post<{ data: ChatReply }>(engine === 'v2' ? '/chat/v2/messages/more' : '/chat/messages/more', { conversationId, page, ...(blockId ? { blockId } : {}) });
  return res.data.data;
}
