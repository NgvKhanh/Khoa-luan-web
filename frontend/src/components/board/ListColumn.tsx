import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { fetchListWatch, setListWatch, type SortListBy } from '../../lib/api/list';
import { fetchCardTemplates } from '../../lib/api/cardTemplate';
import { logError } from '../../lib/logError';
import { getErrorMessage } from '../../lib/errorMessage';
import type { Card } from '../../types/card';
import type { CardTemplate } from '../../types/cardTemplate';
import type { BoardList } from '../../types/list';
import AddCardForm from './AddCardForm';
import CardItem from './CardItem';

interface Props {
  list: BoardList;
  allLists: BoardList[];
  readOnly?: boolean;
  onRename: (listId: string, name: string) => void;
  onRequestDeleteList: (list: BoardList) => void;
  onAddCard: (listId: string, title: string) => Promise<void>;
  onApplyCardTemplate: (listId: string, templateId: string) => Promise<void>;
  onToggleCardDone: (card: Card) => void;
  onRequestDeleteCard: (card: Card) => void;
  onOpenCard: (cardId: string) => void;
  onCopyList: (list: BoardList) => void;
  onMoveList: (list: BoardList, to: 'start' | 'end') => void;
  onMoveAllCards: (list: BoardList, targetListId: string) => void;
  onSortList: (list: BoardList, by: SortListBy) => void;
  onRequestDeleteAllCards: (list: BoardList) => void;
}

const SORT_OPTIONS: { key: SortListBy; label: string }[] = [
  { key: 'created-desc', label: 'Ngày tạo (mới nhất)' },
  { key: 'created-asc', label: 'Ngày tạo (cũ nhất)' },
  { key: 'title-asc', label: 'Tên thẻ (A → Z)' },
  { key: 'done', label: 'Trạng thái hoàn thành' },
];

const ITEM =
  'w-full rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent dark:text-slate-200 dark:hover:bg-slate-700 dark:disabled:text-slate-600';
const SUB_ITEM =
  'w-full rounded px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700';

export default function ListColumn({
  list,
  allLists,
  readOnly = false,
  onRename,
  onRequestDeleteList,
  onAddCard,
  onApplyCardTemplate,
  onToggleCardDone,
  onRequestDeleteCard,
  onOpenCard,
  onCopyList,
  onMoveList,
  onMoveAllCards,
  onSortList,
  onRequestDeleteAllCards,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `list-${list.id}`,
    data: { type: 'list' },
    disabled: readOnly,
  });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(list.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [submenu, setSubmenu] = useState<
    'move' | 'moveCards' | 'sort' | 'cardTemplates' | null
  >(null);
  const [addCardOpen, setAddCardOpen] = useState(false);
  const [watching, setWatching] = useState(false);
  const [cardTemplates, setCardTemplates] = useState<CardTemplate[]>([]);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(
    null
  );
  const [templateError, setTemplateError] = useState<string | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  useEffect(() => {
    if (submenu !== 'cardTemplates' || templatesLoaded) return;
    fetchCardTemplates(list.boardId)
      .then((ts) => {
        setCardTemplates(ts);
        setTemplatesLoaded(true);
      })
      .catch(logError('ListColumn: tai mau the'));
  }, [submenu, templatesLoaded, list.boardId]);

  async function applyTemplate(templateId: string) {
    setApplyingTemplateId(templateId);
    setTemplateError(null);
    try {
      await onApplyCardTemplate(list.id, templateId);
      closeMenu();
    } catch (err) {
      setTemplateError(getErrorMessage(err, 'Không tạo được thẻ từ mẫu.'));
    } finally {
      setApplyingTemplateId(null);
    }
  }

  useEffect(() => {
    if (!menuOpen) return;
    fetchListWatch(list.id)
      .then(setWatching)
      .catch(logError('ListColumn: tai trang thai theo doi'));
  }, [menuOpen, list.id]);

  function closeMenu() {
    setMenuOpen(false);
    setSubmenu(null);
  }

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  function saveName() {
    setEditing(false);
    const name = draft.trim();
    if (!name || name === list.name) {
      setDraft(list.name);
      return;
    }
    onRename(list.id, name);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    // Header cua cot cung la tay cam keo. KeyboardSensor cua dnd-kit coi
    // Enter/Space la phim bat dau keo, nen phai chan su kien lai o day -
    // neu khong, Enter se vua luu ten vua khoi dong mot luot keo "ma"
    // khong bao gio ket thuc (cot ket cung, khong keo tha duoc nua).
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      saveName();
    }
    if (e.key === 'Escape') {
      setDraft(list.name);
      setEditing(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    saveName();
  }

  const otherLists = allLists.filter((l) => l.id !== list.id);
  const hasCards = list.cards.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        isDragging
          ? 'flex max-h-full w-[272px] shrink-0 flex-col rounded-xl border-2 border-dashed border-white/60 bg-white/20 [&>*]:invisible'
          : 'flex max-h-full w-[272px] shrink-0 flex-col rounded-xl bg-[#f1f2f4]/95 shadow-sm backdrop-blur-sm dark:bg-slate-800/95'
      }
    >
      {/* Header - cung la tay cam de keo cot */}
      <div
        ref={readOnly ? undefined : setActivatorNodeRef}
        {...(readOnly ? {} : attributes)}
        {...(readOnly ? {} : listeners)}
        style={{ touchAction: 'none' }}
        className={`relative flex shrink-0 items-center gap-1 px-2 py-1.5 ${
          readOnly ? '' : 'cursor-grab active:cursor-grabbing'
        }`}
      >
        {editing && !readOnly ? (
          <form onSubmit={onSubmit} className="flex-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={onKeyDown}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full rounded border border-[#0c66e4] bg-white px-2 py-1 text-sm font-semibold text-[#172b4d] focus:outline-none dark:bg-slate-900 dark:text-slate-100"
            />
          </form>
        ) : (
          <button
            type="button"
            disabled={readOnly}
            onClick={() => {
              setDraft(list.name);
              setEditing(true);
            }}
            className="flex-1 rounded px-2 py-1 text-left text-sm font-semibold text-[#172b4d] enabled:hover:bg-black/5 dark:text-slate-100 dark:enabled:hover:bg-white/10"
          >
            {list.name}
          </button>
        )}

        <span className="shrink-0 px-1 text-xs text-slate-600 dark:text-slate-300">
          {list.cards.length}
        </span>

        <button
          type="button"
          onClick={() => {
            setMenuOpen((v) => !v);
            setSubmenu(null);
          }}
          aria-label="Hành động danh sách"
          className="shrink-0 rounded p-1 text-slate-500 hover:bg-black/10 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-slate-200"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <circle cx="5" cy="12" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="19" cy="12" r="1.6" />
          </svg>
        </button>

        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="Đóng"
              onClick={closeMenu}
              className="fixed inset-0 z-20 cursor-default"
            />
            <div className="absolute right-2 top-10 z-30 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center px-1 pb-1.5">
                <p className="flex-1 text-center text-sm font-semibold text-slate-700 dark:text-slate-100">
                  Thao tác với danh sách
                </p>
                <button
                  type="button"
                  onClick={closeMenu}
                  aria-label="Đóng"
                  className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

              {!readOnly && (
                <>
                  <button
                    type="button"
                    className={ITEM}
                    onClick={() => {
                      setAddCardOpen(true);
                      closeMenu();
                    }}
                  >
                    Thêm thẻ
                  </button>

                  <button
                    type="button"
                    className={ITEM}
                    onClick={() =>
                      setSubmenu((s) => (s === 'cardTemplates' ? null : 'cardTemplates'))
                    }
                  >
                    Thêm thẻ từ mẫu
                  </button>
                  {submenu === 'cardTemplates' && (
                    <div className="mb-1 ml-2 max-h-40 overflow-y-auto border-l border-slate-200 pl-1.5 dark:border-slate-700">
                      {templateError && (
                        <p className="px-2 py-1 text-xs text-red-600">{templateError}</p>
                      )}
                      {!templatesLoaded ? (
                        <p className="px-2 py-1.5 text-xs text-slate-500 dark:text-slate-400">
                          Đang tải...
                        </p>
                      ) : cardTemplates.length === 0 ? (
                        <p className="px-2 py-1.5 text-xs text-slate-500 dark:text-slate-400">
                          Bảng chưa có mẫu thẻ nào.
                        </p>
                      ) : (
                        cardTemplates.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            disabled={applyingTemplateId !== null}
                            className={SUB_ITEM + ' truncate disabled:opacity-50'}
                            onClick={() => void applyTemplate(t.id)}
                          >
                            {applyingTemplateId === t.id ? 'Đang tạo...' : t.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}

              <button
                type="button"
                className={ITEM}
                onClick={() => {
                  const next = !watching;
                  setWatching(next);
                  setListWatch(list.id, next).catch((err) => {
                    setWatching(!next);
                    logError('ListColumn: doi trang thai theo doi')(err);
                  });
                }}
              >
                {watching ? 'Đang theo dõi ✓' : 'Theo dõi danh sách'}
              </button>

              {!readOnly && (
                <>
                  <button
                    type="button"
                    className={ITEM}
                    onClick={() => {
                      onCopyList(list);
                      closeMenu();
                    }}
                  >
                    Sao chép danh sách
                  </button>

                  {/* Di chuyen danh sach */}
                  <button
                    type="button"
                    className={ITEM}
                    onClick={() =>
                      setSubmenu((s) => (s === 'move' ? null : 'move'))
                    }
                  >
                    Di chuyển danh sách
                  </button>
                  {submenu === 'move' && (
                    <div className="mb-1 ml-2 border-l border-slate-200 pl-1.5 dark:border-slate-700">
                      <button
                        type="button"
                        className={SUB_ITEM}
                        onClick={() => {
                          onMoveList(list, 'start');
                          closeMenu();
                        }}
                      >
                        Về đầu
                      </button>
                      <button
                        type="button"
                        className={SUB_ITEM}
                        onClick={() => {
                          onMoveList(list, 'end');
                          closeMenu();
                        }}
                      >
                        Về cuối
                      </button>
                    </div>
                  )}

                  {/* Di chuyen tat ca the */}
                  <button
                    type="button"
                    disabled={!hasCards || otherLists.length === 0}
                    className={ITEM}
                    onClick={() =>
                      setSubmenu((s) => (s === 'moveCards' ? null : 'moveCards'))
                    }
                  >
                    Di chuyển tất cả thẻ trong danh sách này
                  </button>
                  {submenu === 'moveCards' && (
                    <div className="mb-1 ml-2 max-h-40 overflow-y-auto border-l border-slate-200 pl-1.5 dark:border-slate-700">
                      {otherLists.length === 0 ? (
                        <p className="px-2 py-1.5 text-xs text-slate-500 dark:text-slate-400">
                          Không có danh sách nào khác.
                        </p>
                      ) : (
                        otherLists.map((l) => (
                          <button
                            key={l.id}
                            type="button"
                            className={SUB_ITEM + ' truncate'}
                            onClick={() => {
                              onMoveAllCards(list, l.id);
                              closeMenu();
                            }}
                          >
                            {l.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}

                  {/* Sap xep theo */}
                  <button
                    type="button"
                    disabled={!hasCards}
                    className={ITEM}
                    onClick={() =>
                      setSubmenu((s) => (s === 'sort' ? null : 'sort'))
                    }
                  >
                    Sắp xếp theo
                  </button>
                  {submenu === 'sort' && (
                    <div className="mb-1 ml-2 border-l border-slate-200 dark:border-slate-700 pl-1.5">
                      {SORT_OPTIONS.map((o) => (
                        <button
                          key={o.key}
                          type="button"
                          className={SUB_ITEM}
                          onClick={() => {
                            onSortList(list, o.key);
                            closeMenu();
                          }}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="my-1 border-t border-slate-200 dark:border-slate-700" />

                  <button
                    type="button"
                    disabled={!hasCards}
                    className={
                      ITEM +
                      ' text-red-600 hover:bg-red-50 disabled:text-slate-300 dark:text-red-400 dark:hover:bg-red-500/10 dark:disabled:text-slate-600'
                    }
                    onClick={() => {
                      onRequestDeleteAllCards(list);
                      closeMenu();
                    }}
                  >
                    Xoá tất cả thẻ trong danh sách này
                  </button>
                  <button
                    type="button"
                    className={ITEM + ' font-medium'}
                    onClick={() => {
                      onRequestDeleteList(list);
                      closeMenu();
                    }}
                  >
                    Lưu trữ danh sách này
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Vung the - cao theo noi dung, tu cuon khi cham tran chieu cao cot */}
      <div className="list-scroll flex min-h-[4px] flex-col gap-2 overflow-y-auto overscroll-contain px-2 py-0.5">
        <SortableContext
          items={list.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {list.cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              readOnly={readOnly}
              onToggleDone={readOnly ? undefined : onToggleCardDone}
              onRequestDelete={readOnly ? undefined : onRequestDeleteCard}
              onOpen={onOpenCard}
            />
          ))}
        </SortableContext>
      </div>

      {!readOnly && (
        <div className="shrink-0 p-2">
          <AddCardForm
            open={addCardOpen}
            onOpenChange={setAddCardOpen}
            onAdd={(title) => onAddCard(list.id, title)}
          />
        </div>
      )}
    </div>
  );
}
