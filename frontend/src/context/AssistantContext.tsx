import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchChatStatus, fetchMoreAnswer, sendChatChoice, sendChatMessage } from '../lib/api/chat';
import { appendCards, chatErrorText, defaultScopeFor } from '../lib/chatText';
import type { ChatCard, ChatClarifyOption, ChatReply, ChatScope, ChatStatus } from '../types/chat';

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
}

interface AssistantValue {
  open: boolean;
  turns: AssistantTurn[];
  /** Pham vi cua cau hoi TIEP THEO. Hoi thoai rong + chua tu chon -> theo trang dang mo. */
  scope: ChatScope;
  busy: boolean;
  /** null = chua biet (chua tai hoac tai loi). */
  status: ChatStatus | null;
  notice: string | null;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  ask: (text: string) => Promise<void>;
  choose: (option: ChatClarifyOption) => Promise<void>;
  loadMore: (turn: AssistantTurn) => Promise<void>;
  setScope: (scope: ChatScope) => void;
  newConversation: () => void;
}

const AssistantContext = createContext<AssistantValue | undefined>(undefined);

function newTurn(id: number, question: string): AssistantTurn {
  return { id, question, status: 'loading', reply: null, cards: [], page: 1, error: null, loadingMore: false, moreError: null };
}

export function AssistantProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [pinnedScope, setPinnedScope] = useState<ChatScope>({ kind: 'MY' });
  const [scopeChosen, setScopeChosen] = useState(false);
  const [status, setStatus] = useState<ChatStatus | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const conversationId = useRef<string | null>(null);
  const nextId = useRef(1);
  const statusRequested = useRef(false);

  // Hoi thoai rong va nguoi dung chua tu chon -> pham vi di theo trang; da hoi roi thi giu nguyen
  // (bam lien ket the sang trang bang khong duoc tu doi pham vi, mat ngu canh cau noi tiep).
  const pageScope = useMemo(() => defaultScopeFor(location.pathname), [location.pathname]);
  const scope = turns.length === 0 && !scopeChosen ? pageScope : pinnedScope;
  const busy = turns.some((t) => t.status === 'loading' || t.loadingMore);

  const patch = useCallback((id: number, change: (t: AssistantTurn) => Partial<AssistantTurn>) => {
    setTurns((ts) => ts.map((t) => (t.id === id ? { ...t, ...change(t) } : t)));
  }, []);

  const finish = useCallback(
    (id: number, reply: ChatReply) => {
      conversationId.current = reply.conversationId;
      patch(id, () => ({ status: 'done', reply, cards: reply.answer.cards, page: reply.answer.page }));
    },
    [patch]
  );

  const openPanel = useCallback(() => {
    setOpen(true);
    if (!statusRequested.current) {
      statusRequested.current = true;
      fetchChatStatus()
        .then(setStatus)
        .catch(() => {
          statusRequested.current = false; // lan mo sau thu lai
        });
    }
  }, []);

  const closePanel = useCallback(() => setOpen(false), []);
  const togglePanel = useCallback(() => (open ? closePanel() : openPanel()), [open, closePanel, openPanel]);

  const ask = useCallback(
    async (text: string) => {
      const message = text.trim();
      if (message === '' || busy) return;
      const used = scope;
      setPinnedScope(used);
      setNotice(null);
      const id = nextId.current++;
      setTurns((ts) => [...ts, newTurn(id, message)]);
      try {
        const reply = await sendChatMessage({ message, scope: used, conversationId: conversationId.current ?? undefined });
        if (reply.conversationReset) {
          setNotice('Hội thoại trước đã hết hạn nên trợ lý bắt đầu hội thoại mới: câu này không nối tiếp câu trước.');
        }
        finish(id, reply);
      } catch (err) {
        patch(id, () => ({ status: 'error', error: chatErrorText(err, 'MESSAGE').text }));
      }
    },
    [busy, scope, finish, patch]
  );

  const choose = useCallback(
    async (option: ChatClarifyOption) => {
      const cid = conversationId.current;
      if (!cid || busy) return;
      const id = nextId.current++;
      setTurns((ts) => [...ts, newTurn(id, `Chọn: ${option.label}`)]);
      try {
        finish(id, await sendChatChoice(cid, option));
      } catch (err) {
        const e = chatErrorText(err, 'CHOICE');
        if (e.conversationGone) conversationId.current = null;
        patch(id, () => ({ status: 'error', error: e.text }));
      }
    },
    [busy, finish, patch]
  );

  const loadMore = useCallback(
    async (turn: AssistantTurn) => {
      const cid = conversationId.current;
      if (!cid || busy || !turn.reply) return;
      patch(turn.id, () => ({ loadingMore: true, moreError: null }));
      try {
        const next = await fetchMoreAnswer(cid, turn.page + 1);
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
        patch(turn.id, () => ({ loadingMore: false, moreError: e.text }));
      }
    },
    [busy, patch]
  );

  const setScope = useCallback((next: ChatScope) => {
    setPinnedScope(next);
    setScopeChosen(true);
  }, []);

  const newConversation = useCallback(() => {
    conversationId.current = null;
    setTurns([]);
    setScopeChosen(false);
    setNotice(null);
  }, []);

  const value = useMemo<AssistantValue>(
    () => ({ open, turns, scope, busy, status, notice, openPanel, closePanel, togglePanel, ask, choose, loadMore, setScope, newConversation }),
    [open, turns, scope, busy, status, notice, openPanel, closePanel, togglePanel, ask, choose, loadMore, setScope, newConversation]
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant(): AssistantValue {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error('useAssistant phai nam trong <AssistantProvider>');
  return ctx;
}
