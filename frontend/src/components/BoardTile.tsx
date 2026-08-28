import type { MouseEvent } from 'react';
import { Link } from 'react-router-dom';
import { colorForId } from '../lib/avatar';

interface Props {
  id: string;
  name: string;
  memberCount?: number;
  isStarred?: boolean;
  // Neu truyen onToggleStar -> hien nut ngoi sao
  onToggleStar?: (next: boolean) => void;
}

export default function BoardTile({
  id,
  name,
  memberCount,
  isStarred = false,
  onToggleStar,
}: Props) {
  function handleStar(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    onToggleStar?.(!isStarred);
  }

  return (
    <Link
      to={`/projects/${id}/board`}
      className="group relative flex h-24 flex-col justify-between overflow-hidden rounded-lg p-3 font-semibold text-white shadow-sm"
      style={{ backgroundColor: colorForId(id) }}
    >
      <span className="relative z-10 leading-snug line-clamp-2">{name}</span>
      {memberCount !== undefined && (
        <span className="relative z-10 text-xs font-normal text-white/80">
          {memberCount} thành viên
        </span>
      )}
      <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />

      {onToggleStar && (
        <button
          type="button"
          onClick={handleStar}
          title={isStarred ? 'Bỏ đánh dấu sao' : 'Đánh dấu sao'}
          className={`absolute right-1.5 top-1.5 z-20 rounded p-1 transition-opacity ${
            isStarred
              ? 'opacity-100'
              : 'opacity-0 group-hover:opacity-100 focus:opacity-100'
          }`}
        >
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 ${isStarred ? 'fill-yellow-300 stroke-yellow-300' : 'fill-transparent stroke-white'}`}
            strokeWidth="2"
          >
            <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17.9 6.8 20.6l1-5.8-4.3-4.1 5.9-.9z" />
          </svg>
        </button>
      )}
    </Link>
  );
}
