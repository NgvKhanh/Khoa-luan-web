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

  // Ban "noi" theo con tro khi keo
  if (overlay) {
    return (
      <div className="rotate-3 scale-[1.03] cursor-grabbing rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-2xl ring-1 ring-black/5">
        <p className="break-words">{card.title}</p>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, touchAction: 'none' }}
      {...attributes}
      {...listeners}
      className={
        isDragging
          ? 'rounded-lg border-2 border-dashed border-slate-300 bg-slate-200/60 px-3 py-2 text-sm [&>*]:invisible'
          : 'group/card relative cursor-grab rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing'
      }
    >
      <p className="pr-5 break-words">{card.title}</p>

      {onRequestDelete && (
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
