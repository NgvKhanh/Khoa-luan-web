import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useAssistant } from '../../context/AssistantContext';
import { MAX_QUESTION_CHARS, PRIVACY_NOTE, QUICK_QUESTIONS } from '../../lib/chatText';
import AnswerView from './AnswerView';
import ScopePicker from './ScopePicker';

/**
 * Panel tro ly ben phai (§13): portal ra body, nam DUOI Header (top-14). Lop z-[35]: tren noi dung
 * trang + lop phu z-30, DUOI menu / popover z-40 (menu tai khoan, "Tạo mới" cua Header - cung z-40 thi
 * panel ve sau se che mat, loi tim thay khi thu tren trinh duyet) va DUOI modal z-50 (CardModal: bam
 * lien ket the thi the mo de len panel). Bam ra ngoai KHONG dong
 * (nguoi dung vua doc tra loi vua thao tac tren bang); Esc chi dong khi con tro dang o trong panel.
 * Dong panel thi khong render gi: khong dung context bang / khong gian, khong goi API.
 */
export default function AssistantPanel() {
  const { open } = useAssistant();
  return open ? createPortal(<PanelBody />, document.body) : null;
}

function Intro({ busy, onAsk }: { busy: boolean; onAsk: (q: string) => void }) {
  return (
    <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
      <p>
        Trợ lý trả lời về việc của bạn, việc của một thành viên, tiến độ nhóm và số việc của từng người — dựa trên
        các bảng bạn xem được. Trợ lý chỉ đọc, không tạo hay sửa việc.
      </p>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Thử hỏi:</p>
      <div className="flex flex-col items-start gap-1.5">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            disabled={busy}
            onClick={() => onAsk(q)}
            className="rounded-full border border-slate-300 px-3 py-1 text-left text-xs text-slate-700 transition hover:border-primary hover:text-primary-ink disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:border-sky-400 dark:hover:text-sky-300"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function PanelBody() {
  const { turns, busy, status, notice, closePanel, ask, choose, loadMore, newConversation } = useAssistant();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Luot moi / tra loi moi -> cuon xuong cuoi
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  function send() {
    const q = draft.trim();
    if (q === '' || busy) return;
    setDraft('');
    void ask(q);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send();
  }

  function onInputKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter gui, Shift+Enter xuong dong; dang go bo go tieng Viet (IME) thi khong gui
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  function onPanelKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key !== 'Escape') return;
    // Mot hop thoai modal khac dang mo de len panel -> Esc la cua lop tren cung do, khong dong panel
    const panel = e.currentTarget;
    const modalAbove = Array.from(document.querySelectorAll('[aria-modal="true"]')).some((el) => !panel.contains(el));
    if (modalAbove) return;
    e.stopPropagation();
    closePanel();
  }

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-label="Trợ lý công việc"
      onKeyDown={onPanelKeyDown}
      className="fixed bottom-0 right-0 top-14 z-[35] flex w-full flex-col border-l border-slate-200 bg-white shadow-2xl sm:w-[420px] dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Trợ lý công việc</h2>
        {status && !status.llmAvailable && (
          <span
            title="Chưa cấu hình AI: trợ lý hiểu câu hỏi bằng bộ luật."
            className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          >
            Chế độ cơ bản
          </span>
        )}
        <span className="flex-1" />
        <button
          type="button"
          onClick={newConversation}
          disabled={busy || turns.length === 0}
          aria-label="Hội thoại mới"
          title="Hội thoại mới"
          className="grid h-7 w-7 place-items-center rounded text-slate-500 transition hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          onClick={closePanel}
          aria-label="Đóng trợ lý"
          className="grid h-7 w-7 place-items-center rounded text-slate-500 transition hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <ScopePicker />

      {notice && (
        <p role="status" className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
          {notice}
        </p>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {turns.length === 0 ? (
          <Intro busy={busy} onAsk={(q) => void ask(q)} />
        ) : (
          <ol aria-label="Hội thoại" className="space-y-4">
            {turns.map((t, i) => (
              <AnswerView
                key={t.id}
                turn={t}
                latest={i === turns.length - 1}
                busy={busy}
                onChoose={(o) => void choose(o)}
                onMore={(turn) => void loadMore(turn)}
                onAsk={(q) => void ask(q)}
              />
            ))}
          </ol>
        )}
      </div>

      <form onSubmit={onSubmit} className="border-t border-slate-200 px-4 py-3 dark:border-slate-700">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onInputKeyDown}
            maxLength={MAX_QUESTION_CHARS}
            rows={2}
            aria-label="Câu hỏi cho trợ lý"
            placeholder="Hỏi về việc của bạn hoặc của nhóm…"
            className="min-h-0 flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={busy || draft.trim() === ''}
            className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            Gửi
          </button>
        </div>
        <div className="mt-1.5 flex items-start justify-between gap-3 text-[11px] text-slate-400 dark:text-slate-500">
          <span>{PRIVACY_NOTE}</span>
          <span className="shrink-0 tabular-nums">
            {draft.length}/{MAX_QUESTION_CHARS}
          </span>
        </div>
      </form>
    </aside>
  );
}
