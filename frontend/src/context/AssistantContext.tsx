import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { fetchChatStatus, fetchChatConversations, fetchChatConversation, fetchMoreAnswer, sendChatChoice, sendChatMessage } from '../lib/api/chat';
import { appendCards, chatErrorText } from '../lib/chatText';
import type { ChatCard, ChatClarifyOption, ChatConversationHistory, ChatConversationSummary, ChatReply, ChatScope, ChatStatus } from '../types/chat';
import { mergeV2Block } from '../lib/chatV2';

// Hoi thoai cua tro ly (CHATBOT_MODULE.md §13). Provider dat o ProtectedRoute (TREN cac layout) de
// hoi thoai KHONG mat khi bam lien ket the chuyen tu trang chu (MainLayout) sang trang bang
// (BoardViewLayout) - Header bi dung lai khi doi layout nen state khong the nam trong Header.
// Chua mo panel lan nao thi khong goi API nao.

export interface AssistantTurn {
  id: number;
  /** Cau nguoi dung go, hoac "Chọn: …" khi tra loi cau hoi lai. */
  question: string;
  status: 'loading' | 'done' | 'error';
  reply: ChatReply | null;
  /** Danh sach chinh da tai (gop qua cac lan "Xem thêm"). */
  cards: ChatCard[];
  page: number;
  error: string | null;
  loadingMore: boolean;
  moreError: string | null;
  loadingBlockId?: string;
}

interface AssistantValue {
  open: boolean;
  turns: AssistantTurn[];
  busy: boolean;
  /** null = chua biet (chua tai hoac tai loi). */
  status: ChatStatus | null;
  notice: string | null;
  conversations: ChatConversationSummary[];
  activeConversationId: string | null;
  historyLoading: boolean;
  historyError: string | null;
  historyHasMore: boolean;
  olderHasMore: boolean;
  refreshHistory: (more?: boolean) => Promise<void>;
  selectConversation: (id: string) => Promise<boolean>;
  loadOlder: () => Promise<void>;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  ask: (text: string) => Promise<void>;
  choose: (option: ChatClarifyOption) => Promise<void>;
  loadMore: (turn: AssistantTurn, blockId?: string) => Promise<void>;
  newConversation: () => void;
}

const AssistantContext = createContext<AssistantValue | undefined>(undefined);
// MY is the API's scope for all readable boards. Personal-task filters and named boards
// are resolved from the question and conversation by the backend.
const CHAT_SCOPE: ChatScope = { kind: 'MY' };

function newTurn(id: number, question: string): AssistantTurn {
  return { id, question, status: 'loading', reply: null, cards: [], page: 1, error: null, loadingMore: false, moreError: null };
}
function restoredTurns(history: ChatConversationHistory): AssistantTurn[] {
  return history.turns.map((t) => ({ ...newTurn(t.id, t.question), status: t.error ? 'error' : 'done',
    reply: t.reply, cards: t.reply?.answer.cards ?? [], page: t.reply?.answer.page ?? 1, error: t.error,
  }));
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ChatConversationSummary[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [olderHasMore, setOlderHasMore] = useState(false);
  const historyPage = useRef(1);
  const historyRequested = useRef(false);
  const olderBefore = useRef<number | null>(null);
  const conversationId = useRef<string | null>(null);
  const nextId = useRef(1);
  const statusRequested = useRef(false);
  const statusPromise = useRef<Promise<ChatStatus> | null>(null);
  const engine = useRef<'legacy' | 'v2'>('v2');

  const busy = historyLoading || turns.some((t) => t.status === 'loading' || t.loadingMore);

  const applyHistory = useCallback((history: ChatConversationHistory) => {
    conversationId.current = history.conversation.id;
    setActiveConversationId(history.conversation.id);
    setTurns(restoredTurns(history));
    nextId.current = Math.max(1, ...history.turns.map((t) => t.id + 1));
    olderBefore.current = history.before;
    setOlderHasMore(history.hasMore);
    setNotice('Đã mở hội thoại đã lưu. Các câu trả lời bên dưới phản ánh dữ liệu tại thời điểm hỏi.');
  }, []);

  const refreshList = useCallback(async (more = false) => {
    const result = await fetchChatConversations(more ? historyPage.current + 1 : 1);
    historyPage.current = result.page;
    setConversations((prev) => more ? [...prev.filter((p) => !result.conversations.some((n) => n.id === p.id)), ...result.conversations] : result.conversations);
    setHistoryHasMore(result.hasMore);
    return result;
  }, []);
  const refreshHistory = useCallback(async (more = false) => {
    setHistoryLoading(true); setHistoryError(null);
    try { await refreshList(more); }
    catch { setHistoryError('Không thể tải lịch sử trò chuyện. Hãy thử lại.'); }
    finally { setHistoryLoading(false); }
  }, [refreshList]);
  const selectConversation = useCallback(async (id: string) => {
    if (busy) return false;
    setHistoryLoading(true); setHistoryError(null);
    try { applyHistory(await fetchChatConversation(id)); return true; }
    catch { setHistoryError('Không thể mở hội thoại này. Hãy thử lại.'); return false; }
    finally { setHistoryLoading(false); }
  }, [busy, applyHistory]);
  const loadOlder = useCallback(async () => {
    const cid = conversationId.current;
    if (busy || !cid || !olderHasMore || !olderBefore.current) return;
    setHistoryLoading(true); setHistoryError(null);
    try {
      const history = await fetchChatConversation(cid, olderBefore.current);
      setTurns((prev) => [...restoredTurns(history), ...prev]);
      olderBefore.current = history.before; setOlderHasMore(history.hasMore);
    } catch { setHistoryError('Không thể tải tin nhắn trước. Hãy thử lại.'); }
    finally { setHistoryLoading(false); }
  }, [busy, olderHasMore]);

  const patch = useCallback((id: number, change: (t: AssistantTurn) => Partial<AssistantTurn>) => {
    setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, ...change(t) } : t)));
  }, []);

  const finish = useCallback(
    (id: number, reply: ChatReply) => {
      conversationId.current = reply.conversationId;
      setActiveConversationId(reply.conversationId);
      patch(id, () => ({ status: 'done', reply, cards: reply.answer.cards, page: reply.answer.page }));
      if (engine.current === 'v2') void refreshList().catch(() => setHistoryError('Không thể cập nhật danh sách lịch sử. Hãy thử lại.'));
    },
    [patch, refreshList]
  );

  const openPanel = useCallback(() => {
    setOpen(true);
    if (!statusRequested.current) {
      statusRequested.current = true;
      statusPromise.current = fetchChatStatus();
      statusPromise.current
        .then((next) => { engine.current = next.engine ?? 'v2'; setStatus(next); })
        .catch(() => {
          statusRequested.current = false; // lan mo sau thu lai
        });
    }
    if (!historyRequested.current) {
      historyRequested.current = true;
      setHistoryLoading(true); setHistoryError(null);
      void (async () => {
        try {
          try { const next = await statusPromise.current; engine.current = next?.engine ?? 'v2'; } catch { /* Try v2 history directly. */ }
          if (engine.current === 'legacy') return;
          const result = await refreshList();
          if (result.conversations[0]) applyHistory(await fetchChatConversation(result.conversations[0].id));
        } catch { setHistoryError('Không thể tải lịch sử trò chuyện. Hãy thử lại.'); historyRequested.current = false; }
        finally { setHistoryLoading(false); }
      })();
    }
  }, [applyHistory, refreshList]);

  const closePanel = useCallback(() => setOpen(false), []);
  const togglePanel = useCallback(() => (open ? closePanel() : openPanel()), [open, closePanel, openPanel]);

  const ask = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (message === '' || busy) return;
      setNotice(null);
      const id = nextId.current++;
      setTurns((ts) => [...ts, newTurn(id, message)]);
      try {
        if (statusPromise.current) {
          try { const next = await statusPromise.current; engine.current = next.engine ?? 'v2'; }
          catch { /* Keep the selected engine; a failed discovery must not silently downgrade. */ }
        }
        const body = { message, scope: CHAT_SCOPE, conversationId: conversationId.current ?? undefined };
        const reply = engine.current === 'v2' ? await sendChatMessage(body, 'v2') : await sendChatMessage(body);
        if (reply.conversationReset) {
          setNotice('Hội thoại trước đã hết hạn nên trợ lý bắt đầu hội thoại mới: câu này không nối tiếp câu trước.');
        }
        finish(id, reply);
      } catch (err) {
        patch(id, () => ({ status: 'error', error: chatErrorText(err, 'MESSAGE').text }));
        if (engine.current === 'v2') void refreshList().catch(() => setHistoryError('Không thể cập nhật danh sách lịch sử. Hãy thử lại.'));
      }
    },
    [busy, finish, patch, refreshList]
  );

  const choose = useCallback(
    async (option: ChatClarifyOption) => {
      const cid = conversationId.current;
      if (!cid || busy) return;
      const id = nextId.current++;
      setTurns((ts) => [...ts, newTurn(id, `Chọn: ${option.label}`)]);
      try {
        finish(id, engine.current === 'v2' ? await sendChatChoice(cid, option, 'v2') : await sendChatChoice(cid, option));
      } catch (err) {
        const e = chatErrorText(err, 'CHOICE');
        if (e.conversationGone) conversationId.current = null;
        patch(id, () => ({ status: 'error', error: e.text }));
      }
    },
    [busy, finish, patch]
  );

  const loadMore = useCallback(
    async (turn: AssistantTurn, blockId?: string) => {
      const cid = conversationId.current;
      if (!cid || busy || !turn.reply) return;
      const block = turn.reply.answer.blocks?.find((b) => b.id === blockId);
      if (blockId && (!block || block.status !== 'OK' || !block.pagination.hasMore)) return;
      patch(turn.id, () => ({ loadingMore: true, loadingBlockId: blockId, moreError: null }));
      try {
        const page = block?.status === 'OK' ? block.pagination.page + 1 : turn.page + 1;
        const next = engine.current === 'v2' ? await fetchMoreAnswer(cid, page, blockId, 'v2') : await fetchMoreAnswer(cid, page);
        if (blockId && next.answer.blocks) {
          const incoming = next.answer.blocks.find((b) => b.id === blockId);
          if (!incoming) throw new Error('Missing answer block');
          patch(turn.id, (t) => ({ loadingMore: false, loadingBlockId: undefined,
            reply: { ...t.reply!, answer: { ...t.reply!.answer, blocks: t.reply!.answer.blocks?.map((b) => b.id === blockId ? mergeV2Block(b, incoming) : b) } },
          }));
          return;
        }
        patch(turn.id, (t) => {
          const prev = t.reply!;
          const answer = { ...prev.answer, total: next.answer.total, generatedAt: next.answer.generatedAt };
          return {
            loadingMore: false,
            page: next.answer.page,
            cards: appendCards(t.cards, next.answer.cards),
            reply: { ...prev, answer },
            // Du lieu doi giua hai trang (nguoi da roi nhom, the bi xoa...) -> noi ro ly do server dua ra
            moreError: next.answer.total === 0 ? next.answer.text : null,
          };
        });
      } catch (err) {
        const e = chatErrorText(err, 'MORE');
        if (e.conversationGone) conversationId.current = null;
        patch(turn.id, () => ({ loadingMore: false, loadingBlockId: undefined, moreError: e.text }));
      }
    },
    [busy, patch]
  );

  const newConversation = useCallback(() => {
    conversationId.current = null;
    setActiveConversationId(null);
    setTurns([]);
    setNotice(null);
    olderBefore.current = null; setOlderHasMore(false);
  }, []);

  const value = useMemo<AssistantValue>(
    () => ({ open, turns, busy, status, notice, conversations, activeConversationId, historyLoading, historyError, historyHasMore, olderHasMore,
      refreshHistory, selectConversation, loadOlder, openPanel, closePanel, togglePanel, ask, choose, loadMore, newConversation }),
    [open, turns, busy, status, notice, conversations, activeConversationId, historyLoading, historyError, historyHasMore, olderHasMore,
      refreshHistory, selectConversation, loadOlder, openPanel, closePanel, togglePanel, ask, choose, loadMore, newConversation]
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant(): AssistantValue {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error('useAssistant phai nam trong <AssistantProvider>');
  return ctx;
}
