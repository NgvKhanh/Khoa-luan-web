import { useState, type KeyboardEvent } from 'react';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { BoardList as BoardListType } from '../../types/list';
import AddCardForm from './AddCardForm';
import BoardCard from './BoardCard';

interface Props {
  list: BoardListType;
  onAddCard: (listId: string, title: string) => Promise<void>;
  onRenameList: (listId: string, name: string) => Promise<void>;
  onDeleteList: (listId: string) => Promise<void>;
  onOpenCard: (taskId: string) => void;
}

// 1 danh sach (cot) tren bang: co the keo doi vi tri (nam header), doi ten, xoa, them the.
export default function BoardList({
  list,
  onAddCard,
  onRenameList,
  onDeleteList,
  onOpenCard,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `list-${list.id}`, data: { type: 'list' } });

  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(list.name);

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  async function saveName() {
    const value = draftName.trim();
    setIsEditing(false);
    if (!value || value === list.name) {
      setDraftName(list.name);
      return;
    }
    try {
      await onRenameList(list.id, value);
    } catch {
      setDraftName(list.name);
    }
  }

  function handleNameKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') saveName();
    if (e.key === 'Escape') {
      setDraftName(list.name);
      setIsEditing(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-slate-100 ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      {/* Header - cung la tay cam de keo cot */}
      <div
        {...attributes}
        {...listeners}
        className="flex cursor-grab items-center gap-2 px-3 pt-2.5 pb-1.5 active:cursor-grabbing"
      >
        {isEditing ? (
          <input
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={saveName}
            onKeyDown={handleNameKeyDown}
            onPointerDown={(e) => e.stopPropagation()}
            className="w-full rounded border border-blue-500 bg-white px-1.5 py-0.5 text-sm font-semibold focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraftName(list.name);
              setIsEditing(true);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex-1 truncate text-left text-sm font-semibold text-slate-700"
          >
            {list.name}
          </button>
        )}
        <span className="shrink-0 rounded bg-slate-200 px-1.5 text-xs text-slate-500">
          {list.tasks.length}
        </span>
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            if (window.confirm(`Xoá danh sách "${list.name}"?`)) {
              onDeleteList(list.id).catch((err) => {
                window.alert(
                  err instanceof Error ? err.message : 'Không xoá được danh sách.'
                );
              });
            }
          }}
          className="shrink-0 rounded px-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
          title="Xoá danh sách"
        >
          ×
        </button>
      </div>

      {/* Vung the - cuon doc rieng khi nhieu the */}
      <div className="flex min-h-[8px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
        <SortableContext
          items={list.tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {list.tasks.map((task) => (
            <BoardCard key={task.id} task={task} onOpen={onOpenCard} />
          ))}
        </SortableContext>
      </div>

      <div className="px-2 pb-2">
        <AddCardForm onAdd={(title) => onAddCard(list.id, title)} />
      </div>
    </div>
  );
}
