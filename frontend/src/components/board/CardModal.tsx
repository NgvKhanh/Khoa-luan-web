import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  addChecklist,
  addChecklistItem,
  addComment,
  addCardMember,
  attachCardLabel,
  deleteCard,
  deleteChecklist,
  deleteChecklistItem,
  deleteComment,
  detachCardLabel,
  fetchBoardLabels,
  fetchCardDetail,
  moveCard,
  removeCardMember,
  updateCard,
  updateChecklistItem,
} from '../../lib/api/card';
import { initialsOf } from '../../lib/avatar';
import { getErrorMessage } from '../../lib/errorMessage';
import type { BoardMember } from '../../types/board';
import type { CardActivity, CardComment, CardDetail, Label } from '../../types/card';

interface Props {
  cardId: string;
  lists: { id: string; name: string }[];
  boardMembers: BoardMember[];
  currentUserId?: string;
  readOnly?: boolean;
  onClose: () => void;
  onChanged: () => void;
}

const AVATAR_COLORS = [
  '#0079BF',
  '#D29034',
  '#519839',
  '#B04632',
  '#89609E',
  '#CD5A91',
  '#00AECC',
  '#4BBF6B',
];
function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1)
    h = (h * 31 + id.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(h)]!;
}

function Avatar({ id, name, className = 'h-7 w-7 text-xs' }: { id: string; name: string; className?: string }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-semibold text-white ${className}`}
      style={{ backgroundColor: avatarColor(id) }}
      title={name}
    >
      {initialsOf(name)}
    </span>
  );
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function activityText(a: CardActivity): string {
  const d = a.data as Record<string, string>;
  switch (a.type) {
    case 'card.create':
      return `đã thêm thẻ này vào danh sách ${d.listName ?? ''}`;
    case 'card.move':
      return `đã chuyển thẻ từ ${d.fromList} sang ${d.toList}`;
    case 'card.rename':
      return 'đã đổi tên thẻ';
    case 'card.done':
      return 'đã đánh dấu thẻ hoàn thành';
    case 'card.undone':
      return 'đã bỏ đánh dấu hoàn thành';
    case 'card.due.set':
      return 'đã đặt ngày hết hạn';
    case 'card.due.clear':
      return 'đã bỏ ngày hết hạn';
    case 'member.add':
      return `đã thêm ${d.memberName} vào thẻ`;
    case 'checklist.add':
      return `đã thêm việc cần làm "${d.title}"`;
    default:
      return a.type;
  }
}

export default function CardModal({
  cardId,
  lists,
  boardMembers,
  currentUserId,
  readOnly = false,
  onClose,
  onChanged,
}: Props) {
  const [card, setCard] = useState<CardDetail | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [titleDraft, setTitleDraft] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [descDraft, setDescDraft] = useState('');
  const [editingDesc, setEditingDesc] = useState(false);
  const [comment, setComment] = useState('');
  const [panel, setPanel] = useState<'labels' | 'due' | 'members' | 'list' | 'menu' | null>(null);

  const reload = useCallback(async () => {
    const d = await fetchCardDetail(cardId);
    setCard(d);
    setTitleDraft(d.title);
    setDescDraft(d.description ?? '');
    return d;
  }, [cardId]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    reload()
      .then((d) => {
        if (alive) return fetchBoardLabels(d.list.boardId);
      })
      .then((ls) => {
        if (alive && ls) setLabels(ls);
      })
      .catch((err) => alive && setError(getErrorMessage(err, 'Không tải được thẻ.')))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [reload]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  async function run(fn: () => Promise<unknown>) {
    if (readOnly) return;
    setError(null);
    try {
      await fn();
      await reload();
      onChanged();
    } catch (err) {
      setError(getErrorMessage(err, 'Thao tác thất bại.'));
    }
  }

  const feed = useMemo(() => {
    if (!card) return [] as (
      | { kind: 'comment'; at: string; c: CardComment }
      | { kind: 'activity'; at: string; a: CardActivity }
    )[];
    const items: (
      | { kind: 'comment'; at: string; c: CardComment }
      | { kind: 'activity'; at: string; a: CardActivity }
    )[] = [
      ...card.comments.map((c) => ({ kind: 'comment' as const, at: c.createdAt, c })),
      ...card.activities
        .filter((a) => a.type !== 'comment.create')
        .map((a) => ({ kind: 'activity' as const, at: a.createdAt, a })),
    ];
    return items.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime());
  }, [card]);

  const cardLabelIds = new Set(card?.labels.map((l) => l.labelId));
  const cardMemberIds = new Set(card?.members.map((m) => m.userId));
  const dueRef = useRef<HTMLInputElement>(null);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 py-10"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-[760px] max-w-full rounded-xl bg-[#f4f5f7] shadow-2xl">
        {loading || !card ? (
          <p className="p-10 text-center text-sm text-slate-500">
            {error ?? 'Đang tải...'}
          </p>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
              <div className="relative">
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => setPanel(panel === 'list' ? null : 'list')}
                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm text-slate-700 enabled:hover:bg-slate-50"
                >
                  {card.list.name}
                  {!readOnly && ' ▾'}
                </button>
                {panel === 'list' && !readOnly && (
                  <div className="absolute left-0 top-9 z-10 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
                    {lists.map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => {
                          setPanel(null);
                          if (l.id !== card.listId)
                            void run(() => moveCard(card.id, { listId: l.id, position: 0 }));
                        }}
                        className={`block w-full truncate rounded px-2 py-1.5 text-left text-sm hover:bg-slate-100 ${
                          l.id === card.listId ? 'font-semibold text-[#0c66e4]' : 'text-slate-700'
                        }`}
                      >
                        {l.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative ml-auto">
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setPanel(panel === 'menu' ? null : 'menu')}
                    aria-label="Hành động"
                    className="rounded p-1.5 text-slate-500 hover:bg-slate-200"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                      <circle cx="5" cy="12" r="1.8" />
                      <circle cx="12" cy="12" r="1.8" />
                      <circle cx="19" cy="12" r="1.8" />
                    </svg>
                  </button>
                )}
                {panel === 'menu' && !readOnly && (
                  <div className="absolute right-0 top-9 z-10 w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setPanel(null);
                        void run(async () => {
                          await deleteCard(card.id);
                          onClose();
                        });
                      }}
                      className="block w-full rounded px-2 py-1.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Xoá thẻ
                    </button>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                className="rounded p-1.5 text-slate-500 hover:bg-slate-200"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-4 p-4 md:flex-row">
              {/* ===== Cot trai ===== */}
              <div className="min-w-0 flex-1">
                {/* Tieu de + done */}
                <div className="mb-3 flex items-start gap-2">
                  <button
                    type="button"
                    disabled={readOnly}
                    onClick={() => void run(() => updateCard(card.id, { isDone: !card.isDone }))}
                    aria-label="Đánh dấu hoàn thành"
                    className="mt-1"
                  >
                    {card.isDone ? (
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-600 text-white">
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3">
                          <path d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    ) : (
                      <span className="block h-5 w-5 rounded-full border-2 border-slate-400" />
                    )}
                  </button>
                  {editingTitle && !readOnly ? (
                    <textarea
                      autoFocus
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onBlur={() => {
                        setEditingTitle(false);
                        const t = titleDraft.trim();
                        if (t && t !== card.title) void run(() => updateCard(card.id, { title: t }));
                        else setTitleDraft(card.title);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          (e.target as HTMLTextAreaElement).blur();
                        }
                      }}
                      rows={1}
                      className="w-full resize-none rounded border border-[#0c66e4] px-2 py-1 text-lg font-semibold text-slate-900 focus:outline-none"
                    />
                  ) : (
                    <h2
                      onClick={() => !readOnly && setEditingTitle(true)}
                      className={`text-lg font-semibold ${
                        readOnly ? '' : 'cursor-pointer'
                      } ${
                        card.isDone ? 'text-slate-400 line-through' : 'text-slate-900'
                      }`}
                    >
                      {card.title}
                    </h2>
                  )}
                </div>

                {/* Huy hieu: nhan / ngay / thanh vien */}
                {(card.labels.length > 0 || card.dueDate || card.members.length > 0) && (
                  <div className="mb-4 flex flex-wrap gap-4 pl-7">
                    {card.labels.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-semibold text-slate-500">Nhãn</p>
                        <div className="flex flex-wrap gap-1">
                          {card.labels.map((l) => (
                            <span
                              key={l.labelId}
                              className="rounded px-2 py-1 text-xs font-medium text-white"
                              style={{ backgroundColor: l.label.color }}
                            >
                              {l.label.name || '   '}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {card.dueDate && (
                      <div>
                        <p className="mb-1 text-xs font-semibold text-slate-500">Ngày hết hạn</p>
                        <span className="inline-flex items-center gap-1.5 rounded bg-white px-2 py-1 text-xs text-slate-700 ring-1 ring-slate-200">
                          {fmt(card.dueDate)}
                        </span>
                      </div>
                    )}
                    {card.members.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-semibold text-slate-500">Thành viên</p>
                        <div className="flex -space-x-1">
                          {card.members.map((m) => (
                            <Avatar key={m.userId} id={m.userId} name={m.user.name} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Hang nut hanh dong */}
                <div
                  className={`relative mb-4 flex flex-wrap gap-2 pl-7 ${
                    readOnly ? 'hidden' : ''
                  }`}
                >
                  {(['labels', 'due', 'members'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPanel(panel === p ? null : p)}
                      className="rounded bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-300"
                    >
                      {p === 'labels' ? 'Nhãn' : p === 'due' ? 'Ngày' : 'Thành viên'}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => void run(() => addChecklist(card.id, 'Việc cần làm'))}
                    className="rounded bg-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-300"
                  >
                    Việc cần làm
                  </button>

                  {panel === 'labels' && (
                    <div className="absolute left-7 top-10 z-10 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                      <p className="mb-1 text-xs font-semibold text-slate-500">Nhãn</p>
                      <div className="flex flex-col gap-1">
                        {labels.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            onClick={() =>
                              void run(() =>
                                cardLabelIds.has(l.id)
                                  ? detachCardLabel(card.id, l.id)
                                  : attachCardLabel(card.id, l.id)
                              )
                            }
                            className="flex items-center gap-2 rounded px-1 py-1 hover:bg-slate-100"
                          >
                            <span
                              className="h-7 flex-1 rounded"
                              style={{ backgroundColor: l.color }}
                            />
                            {cardLabelIds.has(l.id) && (
                              <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {panel === 'due' && (
                    <div className="absolute left-7 top-10 z-10 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
                      <p className="mb-2 text-xs font-semibold text-slate-500">Ngày hết hạn</p>
                      <input
                        ref={dueRef}
                        type="datetime-local"
                        defaultValue={
                          card.dueDate
                            ? new Date(card.dueDate).toISOString().slice(0, 16)
                            : ''
                        }
                        className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const v = dueRef.current?.value;
                            setPanel(null);
                            void run(() =>
                              updateCard(card.id, {
                                dueDate: v ? new Date(v).toISOString() : null,
                              })
                            );
                          }}
                          className="flex-1 rounded bg-[#0c66e4] py-1.5 text-sm font-medium text-white hover:bg-[#0a5cd4]"
                        >
                          Lưu
                        </button>
                        {card.dueDate && (
                          <button
                            type="button"
                            onClick={() => {
                              setPanel(null);
                              void run(() => updateCard(card.id, { dueDate: null }));
                            }}
                            className="rounded px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                          >
                            Bỏ
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {panel === 'members' && (
                    <div className="absolute left-7 top-10 z-10 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                      <p className="mb-1 text-xs font-semibold text-slate-500">Thành viên</p>
                      <div className="flex flex-col gap-1">
                        {boardMembers.map((m) => (
                          <button
                            key={m.userId}
                            type="button"
                            onClick={() =>
                              void run(() =>
                                cardMemberIds.has(m.userId)
                                  ? removeCardMember(card.id, m.userId)
                                  : addCardMember(card.id, m.userId)
                              )
                            }
                            className="flex items-center gap-2 rounded px-1 py-1 text-left hover:bg-slate-100"
                          >
                            <Avatar id={m.userId} name={m.user.name} />
                            <span className="flex-1 truncate text-sm">{m.user.name}</span>
                            {cardMemberIds.has(m.userId) && (
                              <svg viewBox="0 0 24 24" className="h-4 w-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Mo ta */}
                <div className="mb-5 pl-7">
                  <p className="mb-1 text-sm font-semibold text-slate-700">Mô tả</p>
                  {readOnly ? (
                    <p className="whitespace-pre-wrap rounded-lg bg-white p-2 text-sm text-slate-600 ring-1 ring-slate-200">
                      {card.description || 'Không có mô tả.'}
                    </p>
                  ) : editingDesc ? (
                    <div>
                      <textarea
                        autoFocus
                        rows={4}
                        value={descDraft}
                        onChange={(e) => setDescDraft(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:border-[#0c66e4] focus:outline-none"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDesc(false);
                            void run(() =>
                              updateCard(card.id, { description: descDraft.trim() || null })
                            );
                          }}
                          className="rounded bg-[#0c66e4] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0a5cd4]"
                        >
                          Lưu
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingDesc(false);
                            setDescDraft(card.description ?? '');
                          }}
                          className="rounded px-2 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                        >
                          Huỷ
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingDesc(true)}
                      className="block w-full rounded-lg bg-white p-2 text-left text-sm text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
                    >
                      {card.description || 'Thêm mô tả chi tiết hơn...'}
                    </button>
                  )}
                </div>

                {/* Checklist */}
                <div className="flex flex-col gap-4 pl-7">
                  {card.checklists.map((cl) => {
                    const done = cl.items.filter((i) => i.isDone).length;
                    const pct = cl.items.length ? Math.round((done / cl.items.length) * 100) : 0;
                    return (
                      <div key={cl.id}>
                        <div className="mb-1 flex items-center gap-2">
                          <p className="flex-1 text-sm font-semibold text-slate-700">{cl.title}</p>
                          {!readOnly && (
                            <button
                              type="button"
                              onClick={() => void run(() => deleteChecklist(cl.id))}
                              className="rounded px-1.5 py-0.5 text-xs text-slate-500 hover:bg-slate-200"
                            >
                              Xoá
                            </button>
                          )}
                        </div>
                        <div className="mb-2 flex items-center gap-2">
                          <span className="text-xs text-slate-500">{pct}%</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-200">
                            <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          {cl.items.map((it) => (
                            <div key={it.id} className="group flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={it.isDone}
                                disabled={readOnly}
                                onChange={() =>
                                  void run(() =>
                                    updateChecklistItem(it.id, { isDone: !it.isDone })
                                  )
                                }
                                className="h-4 w-4"
                              />
                              <span
                                className={`flex-1 text-sm ${
                                  it.isDone ? 'text-slate-400 line-through' : 'text-slate-700'
                                }`}
                              >
                                {it.content}
                              </span>
                              {!readOnly && (
                                <button
                                  type="button"
                                  onClick={() => void run(() => deleteChecklistItem(it.id))}
                                  className="rounded p-0.5 text-slate-400 opacity-0 hover:bg-slate-200 group-hover:opacity-100"
                                >
                                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                                    <path d="M6 6l12 12M18 6L6 18" />
                                  </svg>
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        {!readOnly && (
                          <AddItemInput onAdd={(c) => run(() => addChecklistItem(cl.id, c))} />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ===== Cot phai: nhan xet + hoat dong ===== */}
              <div className="w-full shrink-0 md:w-72">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                  </svg>
                  Nhận xét và hoạt động
                </p>

                {!readOnly && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const t = comment.trim();
                      if (!t) return;
                      setComment('');
                      void run(() => addComment(card.id, t));
                    }}
                    className="mb-3 flex gap-2"
                  >
                    <input
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Viết bình luận..."
                      className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0c66e4] focus:outline-none"
                    />
                    {comment.trim() && (
                      <button
                        type="submit"
                        className="shrink-0 rounded-lg bg-[#0c66e4] px-3 text-sm font-medium text-white hover:bg-[#0a5cd4]"
                      >
                        Gửi
                      </button>
                    )}
                  </form>
                )}

                {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

                <ul className="flex flex-col gap-3">
                  {feed.map((it) =>
                    it.kind === 'comment' ? (
                      <li key={`c-${it.c.id}`} className="flex gap-2">
                        <Avatar id={it.c.user.id} name={it.c.user.name} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs">
                            <span className="font-semibold text-slate-700">{it.c.user.name}</span>{' '}
                            <span className="text-slate-400">{fmt(it.c.createdAt)}</span>
                          </p>
                          <p className="mt-0.5 rounded-lg bg-white p-2 text-sm text-slate-700 ring-1 ring-slate-200">
                            {it.c.text}
                          </p>
                          {!readOnly && it.c.user.id === currentUserId && (
                            <button
                              type="button"
                              onClick={() => void run(() => deleteComment(it.c.id))}
                              className="mt-0.5 text-xs text-slate-400 hover:underline"
                            >
                              Xoá
                            </button>
                          )}
                        </div>
                      </li>
                    ) : (
                      <li key={`a-${it.a.id}`} className="flex gap-2">
                        <Avatar id={it.a.user.id} name={it.a.user.name} className="h-6 w-6 text-[10px]" />
                        <p className="text-xs text-slate-500">
                          <span className="font-semibold text-slate-700">{it.a.user.name}</span>{' '}
                          {activityText(it.a)}
                          <br />
                          <span className="text-slate-400">{fmt(it.a.createdAt)}</span>
                        </p>
                      </li>
                    )
                  )}
                </ul>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

function AddItemInput({ onAdd }: { onAdd: (content: string) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState('');
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-1 rounded px-2 py-1 text-left text-sm text-slate-500 hover:bg-slate-200"
      >
        + Thêm mục
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = v.trim();
        if (!t) return;
        setV('');
        void onAdd(t);
      }}
      className="mt-1 flex gap-2"
    >
      <input
        autoFocus
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => !v.trim() && setOpen(false)}
        placeholder="Thêm một mục..."
        className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm focus:border-[#0c66e4] focus:outline-none"
      />
      <button type="submit" className="rounded bg-[#0c66e4] px-3 text-sm font-medium text-white">
        Thêm
      </button>
    </form>
  );
}
