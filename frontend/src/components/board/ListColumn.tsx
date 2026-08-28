import { useState, type FormEvent, type KeyboardEvent } from 'react';
import type { BoardList } from '../../types/list';

interface Props {
  list: BoardList;
  onRename: (listId: string, name: string) => void;
  onRequestDelete: (list: BoardList) => void;
}

export default function ListColumn({ list, onRename, onRequestDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(list.name);

  function save() {
    setEditing(false);
    const name = draft.trim();
    if (!name || name === list.name) {
      setDraft(list.name);
      return;
    }
    onRename(list.id, name);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') {
      setDraft(list.name);
      setEditing(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save();
  }

  return (
    <div className="group flex max-h-full w-72 shrink-0 flex-col rounded-xl bg-[#f1f2f4] shadow-sm">
      <div className="flex items-start gap-1 p-2">
        {editing ? (
          <form onSubmit={onSubmit} className="flex-1">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={save}
              onKeyDown={onKeyDown}
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
          onClick={() => onRequestDelete(list)}
          aria-label="Xoá danh sách"
          className="mt-0.5 shrink-0 rounded p-1 text-slate-500 opacity-0 hover:bg-black/10 hover:text-slate-700 group-hover:opacity-100"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* Vung the - se lam o buoc sau */}
      <div className="min-h-[8px] flex-1 overflow-y-auto px-2 pb-2 text-xs text-slate-400">
        {/* Thẻ sẽ được thêm ở bước tiếp theo */}
      </div>
    </div>
  );
}
