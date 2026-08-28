import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card } from '../../types/card';
import type { BoardList } from '../../types/list';
import AddCardForm from './AddCardForm';
import CardItem from './CardItem';

interface Props {
  list: BoardList;
  onRename: (listId: string, name: string) => void;
  onRequestDeleteList: (list: BoardList) => void;
  onAddCard: (listId: string, title: string) => Promise<void>;
  onToggleCardDone: (card: Card) => void;
  onRequestDeleteCard: (card: Card) => void;
}

export default function ListColumn({
  list,
  onRename,
  onRequestDeleteList,
  onAddCard,
  onToggleCardDone,
  onRequestDeleteCard,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `list-${list.id}`, data: { type: 'list' } });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(list.name);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

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
          onClick={() => setMenuOpen((v) => !v)}
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
              onClick={() => setMenuOpen(false)}
              className="fixed inset-0 z-20 cursor-default"
            />
            <div className="absolute right-2 top-10 z-30 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  onRequestDeleteList(list);
                }}
                className="w-full rounded px-2 py-1.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Xoá danh sách
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
            />
          ))}
        </SortableContext>
      </div>

      <div className="p-2">
        <AddCardForm onAdd={(title) => onAddCard(list.id, title)} />
      </div>
    </div>
  );
}
