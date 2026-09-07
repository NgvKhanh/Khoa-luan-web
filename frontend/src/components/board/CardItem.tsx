import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { assetUrl } from '../../lib/assets';
import type { Card } from '../../types/card';
import Avatar from '../Avatar';

// Dai mau / anh o dinh the (giong Trello)
function CardCover({ card }: { card: Card }) {
  if (card.coverImageUrl) {
    return (
      <div
        className="h-24 w-full bg-cover bg-center"
        style={{ backgroundImage: `url(${assetUrl(card.coverImageUrl)})` }}
      />
    );
  }
  if (card.coverColor) {
    return (
      <div className="h-8 w-full" style={{ backgroundColor: card.coverColor }} />
    );
  }
  return null;
}

interface Props {
  card: Card;
  onToggleDone?: (card: Card) => void;
  onRequestDelete?: (card: Card) => void;
  onOpen?: (cardId: string) => void;
  overlay?: boolean;
  readOnly?: boolean;
}

function DoneCircle({ done }: { done: boolean }) {
  if (done) {
    return (
      <span className="grid h-[18px] w-[18px] place-items-center rounded-full bg-emerald-600 text-white">
        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5">
          <path d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  // Chua xong: vong tron xam ro rang, chuyen xanh + hien dau tich khi tro chuot vao
  return (
    <span className="grid h-[18px] w-[18px] place-items-center rounded-full border-2 border-slate-400 text-transparent transition-colors group-hover/circle:border-emerald-600 group-hover/circle:text-emerald-600">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3.5">
        <path d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}

export default function CardItem({
  card,
  onToggleDone,
  onRequestDelete,
  onOpen,
  overlay,
  readOnly = false,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: card.id,
      data: { type: 'card', listId: card.listId },
      disabled: overlay || readOnly,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  const checklistItems = card.checklists?.flatMap((c) => c.items) ?? [];
  const clDone = checklistItems.filter((i) => i.isDone).length;
  const commentCount = card.comments?.length ?? 0;
  const attachmentCount = card.attachments?.length ?? 0;
  const hasBadges =
    (card.labels?.length ?? 0) > 0 ||
    !!card.dueDate ||
    checklistItems.length > 0 ||
    commentCount > 0 ||
    attachmentCount > 0 ||
    (card.members?.length ?? 0) > 0;

  const body = (
    <>
      <button
        type="button"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onToggleDone?.(card);
        }}
        aria-label={card.isDone ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành'}
        title={card.isDone ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành'}
        className="group/circle mt-0.5 shrink-0"
      >
        <DoneCircle done={card.isDone} />
      </button>

      <div className="min-w-0 flex-1">
        {/* Nhan mau */}
        {(card.labels?.length ?? 0) > 0 && (
          <div className="mb-1 flex flex-wrap gap-1">
            {card.labels!.map((l) => (
              <span
                key={l.labelId}
                className="h-1.5 w-8 rounded-full"
                style={{ backgroundColor: l.label.color }}
              />
            ))}
          </div>
        )}

        <p
          className={`break-words ${
            card.isDone ? 'text-slate-400 line-through' : 'text-[#172b4d]'
          }`}
        >
          {card.title}
        </p>

        {hasBadges && (
          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            {card.description && (
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-label="Có mô tả">
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
            )}
            {card.dueDate && (
              <span className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M3 10h18M8 2v4M16 2v4" />
                </svg>
                {new Date(card.dueDate).toLocaleDateString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                })}
              </span>
            )}
            {checklistItems.length > 0 && (
              <span
                className={`inline-flex items-center gap-0.5 rounded px-1 ${
                  clDone === checklistItems.length ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100'
                }`}
              >
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
                {clDone}/{checklistItems.length}
              </span>
            )}
            {commentCount > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                </svg>
                {commentCount}
              </span>
            )}
            {attachmentCount > 0 && (
              <span className="inline-flex items-center gap-0.5">
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.5l-8.5 8.5a5 5 0 01-7-7l9-9a3.5 3.5 0 015 5l-9 9a2 2 0 01-3-3l8-8" />
                </svg>
                {attachmentCount}
              </span>
            )}
            {(card.members?.length ?? 0) > 0 && (
              <span className="ml-auto flex -space-x-1">
                {card.members!.slice(0, 3).map((m) => (
                  <Avatar
                    key={m.userId}
                    id={m.userId}
                    name={m.user.name}
                    avatarUrl={m.user.avatarUrl}
                    className="h-5 w-5 text-[9px] ring-1 ring-white"
                  />
                ))}
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );

  const hasCover = Boolean(card.coverImageUrl || card.coverColor);

  if (overlay) {
    return (
      <div className="overflow-hidden rotate-3 scale-[1.03] cursor-grabbing rounded-lg bg-white text-sm shadow-2xl ring-1 ring-black/5">
        <CardCover card={card} />
        <div className="flex gap-2 px-3 py-2">{body}</div>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, touchAction: 'none' }}
      {...attributes}
      {...listeners}
      onClick={() => onOpen?.(card.id)}
      className={
        isDragging
          ? 'rounded-lg border-2 border-dashed border-slate-300 bg-slate-200/60 text-sm [&_*]:invisible'
          : 'group/card relative cursor-pointer overflow-hidden rounded-lg bg-white text-sm shadow-sm ring-1 ring-black/[0.04] transition-shadow hover:shadow-md'
      }
    >
      {!isDragging && hasCover && <CardCover card={card} />}
      <div className="flex gap-2 px-3 py-2">{body}</div>

      {onRequestDelete && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRequestDelete(card);
          }}
          aria-label="Lưu trữ thẻ"
          title="Lưu trữ thẻ"
          className="absolute right-1 top-1 rounded bg-white/80 p-0.5 text-slate-400 opacity-0 hover:bg-slate-100 hover:text-slate-600 group-hover/card:opacity-100"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="4" rx="1" />
            <path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8M10 12h4" />
          </svg>
        </button>
      )}
    </div>
  );
}
