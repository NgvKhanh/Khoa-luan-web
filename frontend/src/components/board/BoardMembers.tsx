import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  createInviteLink,
  disableInviteLink,
  fetchJoinRequests,
  getInviteLink,
  approveJoinRequest,
  rejectJoinRequest,
  type AddMemberResult,
} from '../../lib/api/board';
import { getErrorMessage } from '../../lib/errorMessage';
import { logError } from '../../lib/logError';
import { socket } from '../../lib/socket';
import type { BoardMember, JoinRequest } from '../../types/board';
import Avatar from '../Avatar';
import ConfirmDialog from '../ConfirmDialog';

type AssignableRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

function roleLabel(role: BoardMember['role']): string {
  if (role === 'OWNER' || role === 'ADMIN') return 'Quản trị viên';
  if (role === 'VIEWER') return 'Người xem';
  return 'Thành viên';
}

// Dropdown vai tro cho 1 dong thanh vien (chi khi co quyen quan ly)
function RoleMenu({
  member,
  isSelf,
  canTransferOwnership,
  onChangeRole,
  onRemove,
  onTransferOwnership,
}: {
  member: BoardMember;
  isSelf: boolean;
  canTransferOwnership: boolean;
  onChangeRole: (role: AssignableRole) => void;
  onRemove: () => void;
  onTransferOwnership: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-lg border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
      >
        {roleLabel(member.role)}
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" strokeWidth="2">
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
          <div className="absolute right-0 top-9 z-50 w-44 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 shadow-xl">
            {(['ADMIN', 'MEMBER', 'VIEWER'] as AssignableRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  onChangeRole(r);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                {r === 'ADMIN' ? 'Quản trị viên' : r === 'MEMBER' ? 'Thành viên' : 'Người xem'}
                {member.role === r && (
                  <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#0c66e4]" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
            <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
            {canTransferOwnership && (
              <button
                type="button"
                onClick={() => {
                  onTransferOwnership();
                  setOpen(false);
                }}
                className="w-full rounded px-2 py-1.5 text-left text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Chuyển quyền sở hữu
              </button>
            )}
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
  // userId cua nhung nguoi DANG mo bang (realtime). Day avatar chi hien nhung nguoi nay.
  onlineUserIds?: string[];
  isOwner: boolean;
  // Quyen quan ly bang do backend tinh (gom ca OWNER/ADMIN cua khong gian).
  // Neu khong truyen -> tu suy tu isOwner + vai tro ADMIN trong danh sach.
  canManage?: boolean;
  // Mo san panel o tab nay (tu link thong bao). null = khong lam gi.
  openTo?: 'members' | 'requests' | null;
  onOpened?: () => void;
  onAdd: (email: string, role: AssignableRole) => Promise<AddMemberResult>;
  onChangeRole: (userId: string, role: AssignableRole) => Promise<void>;
  onRemove: (userId: string) => Promise<void>;
  onTransferOwnership?: (userId: string) => Promise<void>;
  onApproved: (member: BoardMember) => void;
}

export default function BoardMembers({
  boardId,
  members,
  currentUserId,
  onlineUserIds,
  isOwner,
  canManage: canManageProp,
  openTo,
  onOpened,
  onAdd,
  onChangeRole,
  onRemove,
  onTransferOwnership,
  onApproved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'members' | 'requests'>('members');

  const [email, setEmail] = useState('');
  const [role, setRole] = useState<AssignableRole>('MEMBER');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [link, setLink] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [transferTarget, setTransferTarget] = useState<BoardMember | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const canManage = useMemo(() => {
    if (canManageProp !== undefined) return canManageProp;
    if (isOwner) return true;
    return (
      members.find((m) => m.userId === currentUserId)?.role === 'ADMIN'
    );
  }, [canManageProp, isOwner, members, currentUserId]);

  // Link thong bao "muon tham gia" -> mo san panel o dung tab
  useEffect(() => {
    if (!openTo) return;
    setOpen(true);
    setTab(openTo);
    onOpened?.();
  }, [openTo, onOpened]);

  // Tai link moi khi mo modal
  useEffect(() => {
    if (!open || !canManage) return;
    getInviteLink(boardId)
      .then((r) => setLink(r.url))
      .catch(logError('BoardMembers: tai link moi'));
  }, [open, canManage, boardId]);

  // Yeu cau tham gia: tai luc dau + cap nhat realtime (ke ca khi panel dang dong)
  useEffect(() => {
    if (!canManage) {
      setRequests([]);
      return;
    }
    const reload = () => {
      fetchJoinRequests(boardId)
        .then(setRequests)
        .catch(logError('BoardMembers: tai yeu cau tham gia'));
    };
    reload();
    socket.on('board:join-requests-changed', reload);
    return () => {
      socket.off('board:join-requests-changed', reload);
    };
  }, [canManage, boardId]);

  // Dong panel -> xoa thong bao tam thoi de lan sau mo khong con sot lai
  useEffect(() => {
    if (open) return;
    setNotice(null);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      const inRoot = rootRef.current?.contains(t);
      const inPanel = panelRef.current?.contains(t);
      if (!inRoot && !inPanel) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [open]);

  // Ai dang online: danh sach tu server + luon co ban than (dang xem bang)
  const onlineSet = useMemo(
    () =>
      new Set(
        [...(onlineUserIds ?? []), currentUserId].filter(
          (id): id is string => Boolean(id)
        )
      ),
    [onlineUserIds, currentUserId]
  );
  // Day avatar canh nut chia se: chi hien nguoi dang mo bang
  const present = members.filter((m) => onlineSet.has(m.userId));
  const shown = present.slice(0, 5);
  const extra = present.length - shown.length;

  async function submitInvite(e: FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await onAdd(value, role);
      setEmail('');
      if (result.kind === 'invited') {
        setNotice(
          `${result.email} chưa có tài khoản — đã gửi email mời kèm liên kết tham gia.`
        );
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Không thêm được thành viên.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleTransfer() {
    const target = transferTarget;
    if (!target || !onTransferOwnership) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await onTransferOwnership(target.userId);
      setTransferTarget(null);
      setNotice(`Đã chuyển quyền sở hữu bảng cho ${target.user.name}.`);
    } catch (err) {
      setError(getErrorMessage(err, 'Không chuyển được quyền sở hữu.'));
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
            <Avatar
              id={m.userId}
              name={m.user.name}
              avatarUrl={m.user.avatarUrl}
              className="h-7 w-7 text-xs"
            />
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
        title="Chia sẻ bảng"
        aria-label="Chia sẻ bảng"
        className="grid h-8 w-8 shrink-0 place-items-center rounded bg-white/25 text-white transition-colors hover:bg-white/40"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M3.5 20a5.5 5.5 0 0111 0M17 8h5M19.5 5.5v5" />
        </svg>
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed right-3 top-14 z-50 max-h-[80vh] w-[420px] max-w-[92vw] overflow-y-auto rounded-xl bg-white dark:bg-slate-800 p-4 text-slate-800 dark:text-slate-100 shadow-2xl"
          >
            <div className="mb-4 flex items-center">
              <h2 className="flex-1 text-base font-semibold">Chia sẻ bảng</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Đóng"
                className="rounded p-1 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
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
                  placeholder="Nhập địa chỉ email"
                  className="min-w-0 flex-1 rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-2 text-sm focus:border-[#0c66e4] focus:outline-none"
                />
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as AssignableRole)}
                  className="rounded-lg border border-slate-300 dark:border-slate-600 px-2 py-2 text-sm focus:border-[#0c66e4] focus:outline-none"
                >
                  <option value="MEMBER">Thành viên</option>
                  <option value="ADMIN">Quản trị viên</option>
                  <option value="VIEWER">Người xem</option>
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
              <div className="mb-4 flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-700 px-3 py-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-slate-200 dark:bg-slate-600 text-slate-500 dark:text-slate-400">
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 13a5 5 0 007 0l2-2a5 5 0 00-7-7l-1 1M14 11a5 5 0 00-7 0l-2 2a5 5 0 007 7l1-1" />
                  </svg>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">
                    Chia sẻ bảng này bằng liên kết
                  </p>
                  {link ? (
                    <p className="truncate text-xs text-slate-500 dark:text-slate-400">{link}</p>
                  ) : (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
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
                      className="rounded px-2 py-1 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-50"
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
            {notice && (
              <p className="mb-2 rounded bg-emerald-50 px-2 py-1.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                {notice}
              </p>
            )}

            {/* Tabs */}
            <div className="mb-2 flex gap-4 border-b border-slate-200 dark:border-slate-700 text-sm">
              <button
                type="button"
                onClick={() => setTab('members')}
                className={`-mb-px border-b-2 py-2 font-medium ${
                  tab === 'members'
                    ? 'border-[#0c66e4] text-[#0c66e4]'
                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                Thành viên của bảng{' '}
                <span className="rounded bg-slate-100 dark:bg-slate-700 px-1.5 text-xs text-slate-600 dark:text-slate-300">
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
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
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
                    const online = onlineSet.has(m.userId);
                    return (
                      <li
                        key={m.id}
                        className="flex items-center gap-3 rounded-lg px-1 py-1.5"
                      >
                        <span className="relative shrink-0">
                          <Avatar
                            id={m.userId}
                            name={m.user.name}
                            avatarUrl={m.user.avatarUrl}
                            className="h-9 w-9 text-xs"
                          />
                          <span
                            title={online ? 'Đang trong bảng' : 'Ngoại tuyến'}
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-slate-800 ${
                              online ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                            }`}
                          />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {m.user.name}
                            {isSelf && (
                              <span className="text-slate-500 dark:text-slate-400"> (bạn)</span>
                            )}
                          </p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                            {m.user.email}
                            {m.role === 'OWNER' && ' • Chủ bảng'}
                            {m.viaWorkspace && ' • Qua không gian làm việc'}
                          </p>
                        </div>
                        {m.viaWorkspace ||
                        m.role === 'OWNER' ||
                        (!canManage && !isSelf) ? (
                          <span className="shrink-0 text-sm text-slate-500 dark:text-slate-400">
                            {roleLabel(m.role)}
                          </span>
                        ) : canManage ? (
                          <RoleMenu
                            member={m}
                            isSelf={isSelf}
                            canTransferOwnership={
                              isOwner && !isSelf && Boolean(onTransferOwnership)
                            }
                            onChangeRole={(r) => onChangeRole(m.userId, r)}
                            onRemove={() => onRemove(m.userId)}
                            onTransferOwnership={() => setTransferTarget(m)}
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
                        className="px-1 py-6 text-center text-sm text-slate-500 dark:text-slate-400"
                      >
                        Chưa có yêu cầu tham gia nào.
                      </li>,
                    ]
                  : requests.map((r) => (
                      <li
                        key={r.id}
                        className="flex items-center gap-3 rounded-lg px-1 py-1.5"
                      >
                        <Avatar
                          id={r.userId}
                          name={r.user.name}
                          avatarUrl={r.user.avatarUrl}
                          className="h-9 w-9 text-xs"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {r.user.name}
                          </p>
                          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
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
                          className="shrink-0 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          Từ chối
                        </button>
                      </li>
                    ))}
            </ul>
          </div>,
          document.body
        )}

      <ConfirmDialog
        open={transferTarget != null}
        title="Chuyển quyền sở hữu bảng"
        message={
          transferTarget
            ? `${transferTarget.user.name} sẽ trở thành chủ bảng. Bạn sẽ bị hạ xuống Quản trị viên và không thể hoàn tác thao tác này.`
            : undefined
        }
        confirmLabel="Chuyển quyền"
        danger
        busy={busy}
        onConfirm={handleTransfer}
        onCancel={() => setTransferTarget(null)}
      />
    </div>
  );
}
