import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  createInviteLink,
  disableInviteLink,
  fetchJoinRequests,
  getInviteLink,
  approveJoinRequest,
  rejectJoinRequest,
} from '../../lib/api/board';
import { initialsOf } from '../../lib/avatar';
import { getErrorMessage } from '../../lib/errorMessage';
import type { BoardMember, JoinRequest } from '../../types/board';

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
  for (let i = 0; i < id.length; i += 1)
    h = (h * 31 + id.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[Math.abs(h)]!;
}

type AssignableRole = 'ADMIN' | 'MEMBER';

function roleLabel(role: BoardMember['role']): string {
  if (role === 'OWNER' || role === 'ADMIN') return 'Quản trị viên';
  return 'Thành viên';
}

function Avatar({
  userId,
  name,
  className = 'h-7 w-7',
}: {
  userId: string;
  name: string;
  className?: string;
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full text-xs font-semibold text-white ${className}`}
      style={{ backgroundColor: avatarColor(userId) }}
    >
      {initialsOf(name)}
    </span>
  );
}

// Dropdown vai tro cho 1 dong thanh vien (chi khi co quyen quan ly)
function RoleMenu({
  member,
  isSelf,
  onChangeRole,
  onRemove,
}: {
  member: BoardMember;
  isSelf: boolean;
  onChangeRole: (role: AssignableRole) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        {roleLabel(member.role)}
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Đóng"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-9 z-50 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
            {(['ADMIN', 'MEMBER'] as AssignableRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  onChangeRole(r);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                {r === 'ADMIN' ? 'Quản trị viên' : 'Thành viên'}
                {member.role === r && (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#0c66e4]" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
            <div className="my-1 border-t border-slate-200" />
            <button
              type="button"
              onClick={() => {
                onRemove();
                setOpen(false);
              }}
              className="w-full rounded px-2 py-1.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
            >
              {isSelf ? 'Rời khỏi bảng' : 'Xoá khỏi bảng'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

interface Props {
  boardId: string;
  members: BoardMember[];
  currentUserId?: string;
  isOwner: boolean;
  onAdd: (email: string, role: AssignableRole) => Promise<void>;
  onChangeRole: (userId: string, role: AssignableRole) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
  onApproved: (member: BoardMember) => void;
}

export default function BoardMembers({
  boardId,
  members,
  currentUserId,
  isOwner,
  onAdd,
  onChangeRole,
  onRemove,
  onApproved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'members' | 'requests'>('members');

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableRole>('MEMBER');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [link, setLink] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);

  const canManage = useMemo(() => {
    if (isOwner) return true;
    return (
      members.find((m) => m.userId === currentUserId)?.role === 'ADMIN'
    );
  }, [isOwner, members, currentUserId]);

  // Tai link moi + yeu cau tham gia khi mo modal
  useEffect(() => {
    if (!open || !canManage) return;
    getInviteLink(boardId)
      .then((r) => setLink(r.url))
      .catch(() => {});
    fetchJoinRequests(boardId)
      .then(setRequests)
      .catch(() => {});
  }, [open, canManage, boardId]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  const shown = members.slice(0, 5);
  const extra = members.length - shown.length;

  async function submitInvite(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      await onAdd(value, role);
      setEmail('');
    } catch (err) {
      setError(getErrorMessage(err, 'Không thêm được thành viên.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateLink() {
    setLinkBusy(true);
    try {
      const r = await createInviteLink(boardId);
      setLink(r.url);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tạo được liên kết.'));
    } finally {
      setLinkBusy(false);
    }
  }

  async function handleDisableLink() {
    setLinkBusy(true);
    try {
      await disableInviteLink(boardId);
      setLink(null);
    } finally {
      setLinkBusy(false);
    }
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* trinh duyet chan clipboard */
    }
  }

  async function handleApprove(req: JoinRequest) {
    setRequests((cur) => cur.filter((r) => r.id !== req.id));
    try {
      const member = await approveJoinRequest(boardId, req.id);
      onApproved(member);
    } catch (err) {
      setRequests((cur) => [...cur, req]);
      setError(getErrorMessage(err, 'Không duyệt được yêu cầu.'));
    }
  }

  async function handleReject(req: JoinRequest) {
    setRequests((cur) => cur.filter((r) => r.id !== req.id));
    try {
      await rejectJoinRequest(boardId, req.id);
    } catch (err) {
      setRequests((cur) => [...cur, req]);
      setError(getErrorMessage(err, 'Không từ chối được yêu cầu.'));
    }
  }

  return (
    <div ref={rootRef} className="relative flex items-center gap-2">
      <div className="flex -space-x-2">
        {shown.map((m) => (
          <span key={m.id} className="ring-2 ring-white/70 rounded-full">
            <Avatar userId={m.userId} name={m.user.name} />
          </span>
        ))}
        {extra > 0 && (
          <span className="grid h-7 w-7 place-items-center rounded-full bg-black/40 text-xs font-semibold text-white ring-2 ring-white/70">
            +{extra}
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded bg-white/25 px-2.5 py-1.5 text-sm font-medium text-white hover:bg-white/40"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M3.5 20a5.5 5.5 0 0111 0M17 8h5M19.5 5.5v5" />
        </svg>
        Chia sẻ
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 max-h-[80vh] w-[420px] max-w-[92vw] overflow-y-auto rounded-xl bg-white p-4 text-slate-800 shadow-2xl">
            <div className="mb-4 flex items-center">
              <h2 className="flex-1 text-base font-semibold">Chia sẻ bảng</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng"
                className="rounded p-1 text-slate-500 hover:bg-slate-100"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {/* Moi qua email */}
            {canManage && (
              <form onSubmit={submitInvite} className="mb-3 flex gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Địa chỉ email hoặc tên"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0c66e4] focus:outline-none"
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as AssignableRole)}
                  className="rounded-lg border border-slate-300 px-2 py-2 text-sm focus:border-[#0c66e4] focus:outline-none"
                >
                  <option value="MEMBER">Thành viên</option>
                  <option value="ADMIN">Quản trị viên</option>
                </select>
                <button
                  type="submit"
                  disabled={busy || !email.trim()}
                  className="shrink-0 rounded-lg bg-[#0c66e4] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a5cd4] disabled:opacity-50"
                >
                  {busy ? '...' : 'Chia sẻ'}
                </button>
              </form>
            )}

            {/* Link moi */}
            {canManage && (
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-slate-200 text-slate-500">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    Chia sẻ bảng này bằng liên kết
                  </p>
                  {link ? (
                    <p className="truncate text-xs text-slate-500">{link}</p>
                  ) : (
                    <p className="text-xs text-slate-400">
                      Bất kỳ ai có liên kết đều có thể gửi yêu cầu tham gia.
                    </p>
                  )}
                </div>
                {link ? (
                  <div className="flex shrink-0 gap-2 text-sm font-medium">
                    <button
                      type="button"
                      onClick={copyLink}
                      className="rounded px-2 py-1 text-[#0c66e4] hover:bg-[#0c66e4]/10"
                    >
                      {copied ? 'Đã sao chép' : 'Sao chép'}
                    </button>
                    <button
                      type="button"
                      disabled={linkBusy}
                      onClick={handleDisableLink}
                      className="rounded px-2 py-1 text-slate-500 hover:bg-slate-200 disabled:opacity-50"
                    >
                      Xoá liên kết
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={linkBusy}
                    onClick={handleCreateLink}
                    className="shrink-0 rounded px-2 py-1 text-sm font-medium text-[#0c66e4] hover:bg-[#0c66e4]/10 disabled:opacity-50"
                  >
                    {linkBusy ? '...' : 'Tạo liên kết'}
                  </button>
                )}
              </div>
            )}

            {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

            {/* Tabs */}
            <div className="mb-2 flex gap-4 border-b border-slate-200 text-sm">
              <button
                type="button"
                onClick={() => setTab('members')}
                className={`-mb-px border-b-2 py-2 font-medium ${
                  tab === 'members'
                    ? 'border-[#0c66e4] text-[#0c66e4]'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
              >
                Thành viên của bảng{' '}
                <span className="rounded bg-slate-100 px-1.5 text-xs text-slate-600">
                  {members.length}
                </span>
              </button>
              {canManage && (
                <button
                  type="button"
                  onClick={() => setTab('requests')}
                  className={`-mb-px border-b-2 py-2 font-medium ${
                    tab === 'requests'
                      ? 'border-[#0c66e4] text-[#0c66e4]'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Yêu cầu tham gia{' '}
                  {requests.length > 0 && (
                    <span className="rounded bg-red-100 px-1.5 text-xs text-red-600">
                      {requests.length}
                    </span>
                  )}
                </button>
              )}
            </div>

            <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto py-1">
              {tab === 'members'
                ? members.map((m) => {
                    const isSelf = m.userId === currentUserId;
                    return (
                      <li
                        key={m.id}
                        className="flex items-center gap-3 rounded-lg px-1 py-1.5"
                      >
                        <Avatar userId={m.userId} name={m.user.name} className="h-9 w-9" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {m.user.name}
                            {isSelf && (
                              <span className="text-slate-400"> (bạn)</span>
                            )}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {m.user.email}
                            {m.role === 'OWNER' && ' • Chủ bảng'}
                          </p>
                        </div>
                        {m.role === 'OWNER' || (!canManage && !isSelf) ? (
                          <span className="shrink-0 text-sm text-slate-500">
                            {roleLabel(m.role)}
                          </span>
                        ) : canManage ? (
                          <RoleMenu
                            member={m}
                            isSelf={isSelf}
                            onChangeRole={(r) => onChangeRole(m.userId, r)}
                            onRemove={() => onRemove(m.userId)}
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => onRemove(m.userId)}
                            className="shrink-0 rounded px-2 py-1 text-sm font-medium text-red-600 hover:bg-red-50"
                          >
                            Rời khỏi bảng
                          </button>
                        )}
                      </li>
                    );
                  })
                : requests.length === 0
                  ? [
                      <li
                        key="empty"
                        className="px-1 py-6 text-center text-sm text-slate-400"
                      >
                        Chưa có yêu cầu tham gia nào.
                      </li>,
                    ]
                  : requests.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center gap-3 rounded-lg px-1 py-1.5"
                      >
                        <Avatar userId={r.userId} name={r.user.name} className="h-9 w-9" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {r.user.name}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {r.user.email}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleApprove(r)}
                          className="shrink-0 rounded-lg bg-[#0c66e4] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0a5cd4]"
                        >
                          Đồng ý
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReject(r)}
                          className="shrink-0 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
                        >
                          Từ chối
                        </button>
                      </li>
                    ))}
            </ul>
        </div>
      )}
    </div>
  );
}
