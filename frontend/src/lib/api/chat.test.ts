import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../axios', () => ({ api: { get: mocks.get, post: mocks.post } }));

import { fetchChatStatus, fetchMoreAnswer, sendChatChoice, sendChatMessage } from './chat';

// Lop goi API cua tro ly: dung DUONG DAN, dung THAN yeu cau (khong kem gi ngoai hop dong §12),
// boc `res.data.data`. Cac test giao dien mock lop nay nen day la cho DUY NHAT kiem tra no.

beforeEach(() => {
  vi.resetAllMocks();
});

describe('lib/api/chat', () => {
  it('fetchChatStatus: GET /chat/status, tra data.data', async () => {
    mocks.get.mockResolvedValue({ data: { data: { llmAvailable: true } } });
    await expect(fetchChatStatus()).resolves.toEqual({ llmAvailable: true });
    expect(mocks.get).toHaveBeenCalledWith('/chat/status');
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
  });

  it('fetchMoreAnswer: POST /chat/messages/more voi {conversationId, page}, tra data.data', async () => {
    const reply = { conversationId: 'c1', answer: { page: 3 } };
    mocks.post.mockResolvedValue({ data: { data: reply } });
    await expect(fetchMoreAnswer('c1', 3)).resolves.toEqual(reply);
    expect(mocks.post).toHaveBeenCalledWith('/chat/messages/more', { conversationId: 'c1', page: 3 });
  });
});
