import { api } from '../axios';
import type { ChatReply, ChatScope, ChatStatus } from '../../types/chat';

// Lop goi API cua tro ly (CHATBOT_MODULE.md §12). Client CHI gui cau hoi, pham vi va ma hoi
// thoai - khong bao gio gui vai tro, danh tinh hay id nguoi duoc nhac (server tu kiem quyen).

// GET /api/chat/status - co AI hay khong (khong bao gio 503: thieu AI thi dung bo luat).
export async function fetchChatStatus(): Promise<ChatStatus> {
  const res = await api.get<{ data: ChatStatus }>('/chat/status');
  return res.data.data;
}

// POST /api/chat/messages - hoi mot cau.
export async function sendChatMessage(input: {
  message: string;
  scope: ChatScope;
  conversationId?: string;
}): Promise<ChatReply> {
  const body = {
    message: input.message,
    scope: input.scope,
    ...(input.conversationId ? { conversationId: input.conversationId } : {}),
  };
  const res = await api.post<{ data: ChatReply }>('/chat/messages', body);
  return res.data.data;
}

// POST /api/chat/messages/choice - tra loi cau hoi lai ("Ý bạn là ai?" / "không gian nào?" / "bảng nào?"). Khong goi AI.
// Gui DUNG MOT trong userId / workspaceId / targetId theo loai lua chon.
export async function sendChatChoice(
  conversationId: string,
  option: { kind: 'USER' | 'WORKSPACE' | 'TARGET'; id: string }
): Promise<ChatReply> {
  const body =
    option.kind === 'USER'
      ? { conversationId, userId: option.id }
      : option.kind === 'WORKSPACE'
        ? { conversationId, workspaceId: option.id }
        : { conversationId, targetId: option.id };
  const res = await api.post<{ data: ChatReply }>('/chat/messages/choice', body);
  return res.data.data;
}

// POST /api/chat/messages/more - trang tiep theo cua cau tra loi cuoi. Khong goi AI.
export async function fetchMoreAnswer(conversationId: string, page: number): Promise<ChatReply> {
  const res = await api.post<{ data: ChatReply }>('/chat/messages/more', { conversationId, page });
  return res.data.data;
}
