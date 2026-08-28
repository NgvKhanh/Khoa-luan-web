import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SortListBy } from '../../lib/api/list';
import type { Card } from '../../types/card';
import type { BoardList } from '../../types/list';
import AddCardForm from './AddCardForm';
import CardItem from './CardItem';

interface Props {
  list: BoardList;
  allLists: BoardList[];
  onRename: (listId: string, name: string) => void;
  onRequestDeleteList: (list: BoardList) => void;
  onAddCard: (listId: string, title: string) => Promise<void>;
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
  'w-full rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent';
const SUB_ITEM =
  'w-full rounded px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-100';

export default function ListColumn({
  list,
  allLists,
  onRename,
  onRequestDeleteList,
  onAddCard,
  onToggleCardDone,
  onRequestDeleteCard,
  onOpenCard,
  onCopyList,
  onMoveList,
  onMoveAllCards,
  onSortList,
  onRequestDeleteAllCards,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `list-${list.id}`, data: { type: 'list' } });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(list.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [submenu, setSubmenu] = useState<'move' | 'moveCards' | 'sort' | null>(
    null
  );
  const [addCardOpen, setAddCardOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

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
    if (e.key === 'Enter') saveName();
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
          : 'flex max-h-full w-[272px] shrink-0 flex-col rounded-xl bg-[#f1f2f4]/95 shadow-sm backdrop-blur-sm'
      }
    >
      {/* Header - cung la tay cam de keo cot */}
      <div
        {...attributes}
        {...listeners}
        style={{ touchAction: 'none' }}
        className="relative flex cursor-grab items-center gap-1 px-2 py-1.5 active:cursor-grabbing"
      >
        {editing ? (
          <form onSubmit={onSubmit} className="flex-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={onKeyDown}
              onPointerDown={(e) => e.stopPropagation()}
              className="w-full rounded border border-[#0c66e4] bg-white px-2 py-1 text-sm font-semibold text-[#172b4d] focus:outline-none"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(list.name);
              setEditing(true);
            }}
            className="flex-1 rounded px-2 py-1 text-left text-sm font-semibold text-[#172b4d] hover:bg-black/5"
          >
            {list.name}
          </button>
        )}

        <span className="shrink-0 px-1 text-xs text-slate-500">
          {list.cards.length}
        </span>

        <button
          type="button"
          onClick={() => {
            setMenuOpen((v) => !v);
            setSubmenu(null);
          }}
          aria-label="Hành động danh sách"
          className="shrink-0 rounded p-1 text-slate-500 hover:bg-black/10 hover:text-slate-700"
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
            <div className="absolute right-2 top-10 z-30 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl">
              <div className="flex items-center px-1 pb-1.5">
                <p className="flex-1 text-center text-sm font-semibold text-slate-700">
                  Thao tác với danh sách
                </p>
                <button
                  type="button"
                  onClick={closeMenu}
                  aria-label="Đóng"
                  className="rounded p-1 text-slate-500 hover:bg-slate-100"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>

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
                <div className="mb-1 ml-2 border-l border-slate-200 pl-1.5">
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
                <div className="mb-1 ml-2 max-h-40 overflow-y-auto border-l border-slate-200 pl-1.5">
                  {otherLists.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-slate-400">
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
                <div className="mb-1 ml-2 border-l border-slate-200 pl-1.5">
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

              <div className="my-1 border-t border-slate-200" />

              <button
                type="button"
                disabled={!hasCards}
                className={
                  ITEM + ' text-red-600 hover:bg-red-50 disabled:text-slate-300'
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
                className={ITEM + ' font-medium text-red-600 hover:bg-red-50'}
                onClick={() => {
                  onRequestDeleteList(list);
                  closeMenu();
                }}
              >
                Xoá danh sách này
              </button>
            </div>
          </>
        )}
      </div>

      {/* Vung the - cao theo noi dung, cuon rieng khi nhieu */}
      <div className="flex min-h-[4px] flex-col gap-2 overflow-y-auto px-2">
        <SortableContext
          items={list.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {list.cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
              onToggleDone={onToggleCardDone}
              onRequestDelete={onRequestDeleteCard}
              onOpen={onOpenCard}
            />
          ))}
        </SortableContext>
      </div>

      <div className="p-2">
        <AddCardForm
          open={addCardOpen}
          onOpenChange={setAddCardOpen}
          onAdd={(title) => onAddCard(list.id, title)}
        />
      </div>
    </div>
  );
}
