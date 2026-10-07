import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../axios', () => ({ api: { get: mocks.get, post: mocks.post } }));

import { fetchChatStatus, fetchChatConversations, fetchChatConversation, fetchMoreAnswer, sendChatChoice, sendChatMessage } from './chat';

// Lop goi API cua tro ly: dung DUONG DAN, dung THAN yeu cau (khong kem gi ngoai hop dong §12),
// boc `res.data.data`. Cac test giao dien mock lop nay nen day la cho DUY NHAT kiem tra no.

beforeEach(() => {
  vi.resetAllMocks();
});

describe('lib/api/chat', () => {
  it('reads owned conversation history with bounded page/cursor inputs', async () => {
    mocks.get.mockResolvedValue({ data: { data: { turns: [] } } });
    await fetchChatConversations(2);
    expect(mocks.get).toHaveBeenLastCalledWith('/chat/v2/conversations', { params: { page: 2 } });
    await fetchChatConversation('thread/id', 50);
    expect(mocks.get).toHaveBeenLastCalledWith('/chat/v2/conversations/thread%2Fid', { params: { before: 50 } });
  });
  it('routes all v2 operations using server IDs, without accepting client tool plans', async () => {
    mocks.post.mockResolvedValue({ data: { data: {} } });
    await sendChatMessage({ message: 'hai phần', scope: { kind: 'MY' } }, 'v2');
    expect(mocks.post).toHaveBeenLastCalledWith('/chat/v2/messages', { message: 'hai phần', scope: { kind: 'MY' } });
    await sendChatChoice('session', { kind: 'TARGET', id: 'board' }, 'v2');
    expect(mocks.post).toHaveBeenLastCalledWith('/chat/v2/messages/choice', { conversationId: 'session', optionId: 'board' });
    await fetchMoreAnswer('session', 2, 'block', 'v2');
    expect(mocks.post).toHaveBeenLastCalledWith('/chat/v2/messages/more', { conversationId: 'session', page: 2, blockId: 'block' });
  });
  it('fetchChatStatus: GET /chat/status, tra data.data', async () => {
    mocks.get.mockResolvedValue({ data: { data: { llmAvailable: true } } });
    await expect(fetchChatStatus()).resolves.toEqual({ llmAvailable: true });
    expect(mocks.get).toHaveBeenCalledWith('/chat/v2/status');
  });

  it('sendChatMessage: POST /chat/messages voi {message, scope} (+ conversationId khi co) - khong gui gi khac', async () => {
    const reply = { conversationId: 'c1', understood: {}, answer: {} };
    mocks.post.mockResolvedValue({ data: { data: reply } });

    await expect(sendChatMessage({ message: 'Việc của tôi?', scope: { kind: 'MY' } })).resolves.toEqual(reply);
    expect(mocks.post).toHaveBeenLastCalledWith('/chat/messages', { message: 'Việc của tôi?', scope: { kind: 'MY' } });

    await sendChatMessage({ message: 'còn tuần sau?', scope: { kind: 'BOARD', boardId: 'b1' }, conversationId: 'c1' });
    expect(mocks.post).toHaveBeenLastCalledWith('/chat/messages', {
      message: 'còn tuần sau?',
      scope: { kind: 'BOARD', boardId: 'b1' },
      conversationId: 'c1',
    });
    // conversationId rong -> khong gui khoa (server bao 400 neu gui chuoi khong phai uuid)
    await sendChatMessage({ message: 'x', scope: { kind: 'MY' }, conversationId: '' });
    expect(Object.keys(mocks.post.mock.calls[2]![1])).toEqual(['message', 'scope']);
  });

  it('sendChatChoice: POST /chat/messages/choice voi DUNG MOT trong userId / workspaceId theo loai lua chon', async () => {
    mocks.post.mockResolvedValue({ data: { data: { conversationId: 'c1' } } });
    await sendChatChoice('c1', { kind: 'USER', id: 'u2' });
    expect(mocks.post).toHaveBeenLastCalledWith('/chat/messages/choice', { conversationId: 'c1', userId: 'u2' });
    await sendChatChoice('c1', { kind: 'WORKSPACE', id: 'ws2' });
    expect(mocks.post).toHaveBeenLastCalledWith('/chat/messages/choice', { conversationId: 'c1', workspaceId: 'ws2' });
    // trung ten bang / khong gian (§18): targetId
    await sendChatChoice('c1', { kind: 'TARGET', id: 'b7' });
    expect(mocks.post).toHaveBeenLastCalledWith('/chat/messages/choice', { conversationId: 'c1', targetId: 'b7' });
    for (const kind of ['USER', 'WORKSPACE', 'TARGET'] as const) {
      await sendChatChoice('c1', { kind, id: 'x' });
      expect(Object.keys(mocks.post.mock.calls.at(-1)![1]).sort()).toHaveLength(2); // conversationId + DUNG MOT id
    }
  });

  it('fetchMoreAnswer: POST /chat/messages/more voi {conversationId, page}, tra data.data', async () => {
    const reply = { conversationId: 'c1', answer: { page: 3 } };
    mocks.post.mockResolvedValue({ data: { data: reply } });
    await expect(fetchMoreAnswer('c1', 3)).resolves.toEqual(reply);
    expect(mocks.post).toHaveBeenCalledWith('/chat/messages/more', { conversationId: 'c1', page: 3 });
  });
});
