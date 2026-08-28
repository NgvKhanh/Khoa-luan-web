import { useState, type FormEvent, type KeyboardEvent } from 'react';
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
  onRequestDeleteCard: (card: Card) => void;
}

export default function ListColumn({
  list,
  onRename,
  onRequestDeleteList,
  onAddCard,
  onRequestDeleteCard,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `list-${list.id}`, data: { type: 'list' } });

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(list.name);

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
          ? 'flex max-h-full w-72 shrink-0 flex-col rounded-xl border-2 border-dashed border-white/60 bg-white/20 [&>*]:invisible'
          : 'group flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-[#f1f2f4] shadow-sm'
      }
    >
      {/* Header - cung la tay cam de keo cot.
          Khong stopPropagation o nut ten/xoa: PointerSensor chi kich hoat keo khi
          di chuyen > 5px, nen bam thuong (khong di chuyen) van vao onClick binh thuong. */}
      <div
        {...attributes}
        {...listeners}
        style={{ touchAction: 'none' }}
        className="flex cursor-grab items-start gap-1 p-2 active:cursor-grabbing"
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
              className="w-full rounded border border-[#0c66e4] bg-white px-2 py-1 text-sm font-semibold text-slate-800 focus:outline-none"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(list.name);
              setEditing(true);
            }}
            className="flex-1 rounded px-2 py-1 text-left text-sm font-semibold text-slate-800 hover:bg-black/5"
          >
            {list.name}
          </button>
        )}

        <button
          type="button"
          onClick={() => onRequestDeleteList(list)}
          aria-label="Xoá danh sách"
          className="mt-0.5 shrink-0 rounded p-1 text-slate-500 opacity-0 hover:bg-black/10 hover:text-slate-700 group-hover:opacity-100"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* Vung the */}
      <div className="flex min-h-[8px] flex-1 flex-col gap-2 overflow-y-auto px-2">
        <SortableContext
          items={list.cards.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
          {list.cards.map((card) => (
            <CardItem
              key={card.id}
              card={card}
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
