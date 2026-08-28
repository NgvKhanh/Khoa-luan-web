import { useEffect, useState, type FormEvent } from 'react';
import { initialsOf } from '../../lib/avatar';
import { getErrorMessage } from '../../lib/errorMessage';
import type { BoardMember } from '../../types/board';

// Mau nen avatar on dinh theo userId
const AVATAR_COLORS = [
  '#0079BF',
  '#D29034',
  '#519839',
  '#B04632',
  '#89609E',
  '#CD5A91',
  '#00AECC',
  '#4BBF6B',
];
function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(h)]!;
}

function Avatar({ member, className = '' }: { member: BoardMember; className?: string }) {
  return (
    <span
      title={`${member.user.name} (${member.user.email})`}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-semibold text-white ${className}`}
      style={{ backgroundColor: avatarColor(member.userId) }}
    >
      {initialsOf(member.user.name)}
    </span>
  );
}

interface Props {
  members: BoardMember[];
  currentUserId?: string;
  isOwner: boolean;
  onAdd: (email: string) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
}

export default function BoardMembers({
  members,
  currentUserId,
  isOwner,
  onAdd,
  onRemove,
}: Props) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const shown = members.slice(0, 5);
  const extra = members.length - shown.length;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd(value);
      setEmail('');
    } catch (err) {
      setError(getErrorMessage(err, 'Không thêm được thành viên.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex items-center gap-2">
      <div className="flex -space-x-2">
        {shown.map((m) => (
          <Avatar key={m.id} member={m} className="ring-2 ring-white/70" />
        ))}
        {extra > 0 && (
          <span className="grid h-7 w-7 place-items-center rounded-full bg-black/40 text-xs font-semibold text-white ring-2 ring-white/70">
            +{extra}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded bg-white/25 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-white/40"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M3.5 20a5.5 5.5 0 0111 0M17 8h5M19.5 5.5v5" />
        </svg>
        Chia sẻ
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Đóng"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 cursor-default"
          />
          <div className="absolute right-0 top-11 z-40 w-80 rounded-xl border border-slate-200 bg-white p-3 text-slate-800 shadow-2xl">
            <p className="mb-2 text-sm font-semibold">Chia sẻ bảng</p>

            {isOwner && (
              <form onSubmit={submit} className="mb-3 flex gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email người muốn mời"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm focus:border-[#0c66e4] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={busy || !email.trim()}
                  className="shrink-0 rounded-lg bg-[#0c66e4] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0a5cd4] disabled:opacity-50"
                >
                  {busy ? '...' : 'Thêm'}
                </button>
              </form>
            )}

            {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

            <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto">
              {members.map((m) => (
                <li key={m.id} className="flex items-center gap-2 rounded-lg px-1 py-1">
                  <Avatar member={m} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {m.user.name}
                      {m.userId === currentUserId && (
                        <span className="text-slate-400"> (bạn)</span>
                      )}
                    </p>
                    <p className="truncate text-xs text-slate-500">{m.user.email}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-500">
                    {m.role === 'OWNER' ? 'Chủ bảng' : 'Thành viên'}
                  </span>
                  {isOwner && m.role !== 'OWNER' && (
                    <button
                      type="button"
                      onClick={() => onRemove(m.userId)}
                      className="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50"
                    >
                      Xoá
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
