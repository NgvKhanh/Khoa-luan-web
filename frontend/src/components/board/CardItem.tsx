import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Card } from '../../types/card';

interface Props {
  card: Card;
  onToggleDone?: (card: Card) => void;
  onRequestDelete?: (card: Card) => void;
  overlay?: boolean;
}

function DoneCircle({ done }: { done: boolean }) {
  if (done) {
    return (
      <span className="grid h-4 w-4 place-items-center rounded-full bg-emerald-600 text-white">
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  return (
    <span className="h-4 w-4 rounded-full border-2 border-slate-300 transition-colors group-hover/card:border-slate-400" />
  );
}

export default function CardItem({
  card,
  onToggleDone,
  onRequestDelete,
  overlay,
}: Props) {
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

  const body = (
    <>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onToggleDone?.(card)}
        aria-label={card.isDone ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành'}
        className="mt-0.5 shrink-0"
      >
        <DoneCircle done={card.isDone} />
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={`break-words ${
            card.isDone ? 'text-slate-400 line-through' : 'text-[#172b4d]'
          }`}
        >
          {card.title}
        </p>
        {card.description && (
          <span className="mt-1 inline-flex text-slate-400" title="Có mô tả">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h10" />
            </svg>
          </span>
        )}
      </div>
    </>
  );

  if (overlay) {
    return (
      <div className="flex rotate-3 scale-[1.03] cursor-grabbing gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-2xl ring-1 ring-black/5">
        {body}
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
          ? 'rounded-lg border-2 border-dashed border-slate-300 bg-slate-200/60 px-3 py-2 text-sm [&_*]:invisible'
          : 'group/card relative flex cursor-grab gap-2 rounded-lg bg-white px-3 py-2 text-sm shadow-sm ring-1 ring-black/[0.04] transition-shadow hover:shadow-md active:cursor-grabbing'
      }
    >
      {body}

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
