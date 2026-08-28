import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card } from '../../types/card';

interface Props {
  card: Card;
  onRequestDelete?: (card: Card) => void;
  overlay?: boolean;
}

export default function CardItem({ card, onRequestDelete, overlay }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: card.id,
      data: { type: 'card', listId: card.listId },
      disabled: overlay,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={overlay ? undefined : style}
      {...attributes}
      {...listeners}
      className={`group/card relative cursor-grab rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm active:cursor-grabbing ${
        isDragging ? 'opacity-40' : ''
      } ${overlay ? 'rotate-2 shadow-lg' : ''}`}
    >
      <p className="pr-5 break-words">{card.title}</p>

      {onRequestDelete && !overlay && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onRequestDelete(card)}
          aria-label="Xoá thẻ"
          className="absolute right-1 top-1 rounded p-0.5 text-slate-400 opacity-0 hover:bg-slate-100 hover:text-slate-600 group-hover/card:opacity-100"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      )}
    </div>
  );
}
