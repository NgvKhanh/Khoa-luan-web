import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Avatar from '../components/Avatar';
import ConfirmDialog from '../components/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useBoards } from '../context/BoardsContext';
import { useWorkspaces } from '../context/WorkspacesContext';
import { assetUrl } from '../lib/assets';
import {
  addWorkspaceMember,
  changeWorkspaceMemberRole,
  deleteWorkspace,
  fetchWorkspace,
  fetchWorkspaceMembers,
  removeWorkspaceMember,
  transferWorkspaceOwnership,
  updateWorkspace,
} from '../lib/api/workspace';
import { getErrorMessage } from '../lib/errorMessage';
import { logError } from '../lib/logError';
import { socket } from '../lib/socket';
import type { Workspace, WorkspaceMember } from '../types/workspace';

type AssignableRole = 'ADMIN' | 'MEMBER';

function roleLabel(r: WorkspaceMember['role']): string {
  if (r === 'OWNER') return 'Chủ không gian';
  if (r === 'ADMIN') return 'Quản trị viên';
  return 'Thành viên';
}

export default function WorkspaceSettingsPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { boards } = useBoards();
  const { reload: reloadWorkspaces, removeWorkspace } = useWorkspaces();

  const [ws, setWs] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [nameDraft, setNameDraft] = useState('');
  const [editingName, setEditingName] = useState(false);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AssignableRole>('MEMBER');
  const [busy, setBusy] = useState(false);

  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [transferTarget, setTransferTarget] = useState<WorkspaceMember | null>(
    null
  );

  const load = useCallback(() => {
    if (!workspaceId) return;
    fetchWorkspace(workspaceId)
      .then(setWs)
      .catch((err) =>
        setLoadError(getErrorMessage(err, 'Không tải được không gian này.'))
      );
    fetchWorkspaceMembers(workspaceId)
      .then(setMembers)
      .catch(logError('WorkspaceSettings: tai thanh vien'));
  }, [workspaceId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: thanh vien doi -> tai lai
  useEffect(() => {
    const onChanged = () => load();
    socket.on('workspace:changed', onChanged);
    return () => {
      socket.off('workspace:changed', onChanged);
    };
  }, [load]);

  const myRole = ws?.myRole ?? 'MEMBER';
  const isOwner = myRole === 'OWNER';
  const canManage = myRole === 'OWNER' || myRole === 'ADMIN';
  const wsBoards = boards.filter((b) => b.workspaceId === workspaceId);

  async function saveName(e: FormEvent) {
    e.preventDefault();
    if (!workspaceId || !nameDraft.trim() || busy) return;
    setBusy(true);
    setActionError(null);
    try {
      const updated = await updateWorkspace(workspaceId, nameDraft.trim());
      setWs((cur) => (cur ? { ...cur, name: updated.name } : cur));
      setEditingName(false);
      void reloadWorkspaces();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Không đổi được tên.'));
    } finally {
      setBusy(false);
    }
  }

  async function submitInvite(e: FormEvent) {
    e.preventDefault();
    if (!workspaceId || !inviteEmail.trim() || busy) return;
    setBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const res = await addWorkspaceMember(
        workspaceId,
        inviteEmail.trim(),
        inviteRole
      );
      setInviteEmail('');
      if (res.kind === 'invited') {
        setNotice(
          `${res.email} chưa có tài khoản — đã gửi email mời đăng ký TaskFlow.`
        );
      } else {
        setMembers((cur) =>
          cur.some((m) => m.userId === res.member.userId)
            ? cur.map((m) => (m.userId === res.member.userId ? res.member : m))
            : [...cur, res.member]
        );
      }
      void reloadWorkspaces();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Không thêm được thành viên.'));
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(userId: string, role: AssignableRole) {
    if (!workspaceId) return;
    const prev = members;
    setMembers((cur) =>
      cur.map((m) => (m.userId === userId ? { ...m, role } : m))
    );
    try {
      await changeWorkspaceMemberRole(workspaceId, userId, role);
    } catch (err) {
      setMembers(prev);
      setActionError(getErrorMessage(err, 'Không đổi được vai trò.'));
    }
  }

  async function removeMember(userId: string) {
    if (!workspaceId) return;
    const prev = members;
    setMembers((cur) => cur.filter((m) => m.userId !== userId));
    try {
      await removeWorkspaceMember(workspaceId, userId);
      void reloadWorkspaces();
    } catch (err) {
      setMembers(prev);
      setActionError(getErrorMessage(err, 'Không xoá được thành viên.'));
    }
  }

  async function doTransfer() {
    if (!workspaceId || !transferTarget) return;
    setBusy(true);
    setActionError(null);
    try {
      await transferWorkspaceOwnership(workspaceId, transferTarget.userId);
      setTransferTarget(null);
      setNotice(`Đã chuyển quyền sở hữu cho ${transferTarget.user.name}.`);
      load();
      void reloadWorkspaces();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Không chuyển được quyền sở hữu.'));
    } finally {
      setBusy(false);
    }
  }

  async function doLeave() {
    if (!workspaceId || !user) return;
    setBusy(true);
    try {
      await removeWorkspaceMember(workspaceId, user.id);
      removeWorkspace(workspaceId);
      void reloadWorkspaces();
      navigate('/', { replace: true });
    } catch (err) {
      setActionError(getErrorMessage(err, 'Không rời được không gian.'));
      setBusy(false);
      setConfirmLeave(false);
    }
  }

  async function doDelete() {
    if (!workspaceId) return;
    setBusy(true);
    try {
      await deleteWorkspace(workspaceId);
      removeWorkspace(workspaceId);
      void reloadWorkspaces();
      navigate('/', { replace: true });
    } catch (err) {
      setActionError(getErrorMessage(err, 'Không xoá được không gian.'));
      setBusy(false);
      setConfirmDelete(false);
    }
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl">
        <p className="text-sm text-red-600">{loadError}</p>
        <Link to="/" className="mt-3 inline-block text-sm text-[#0c66e4] hover:underline">
          Về trang chủ
        </Link>
      </div>
    );
  }
  if (!ws) {
    return <p className="text-sm text-slate-500">Đang tải...</p>;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      {/* Tieu de */}
      <div>
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#0c66e4] text-lg font-bold text-white">
            {ws.name.slice(0, 1).toUpperCase()}
          </span>
          {editingName ? (
            <form onSubmit={saveName} className="flex flex-1 gap-2">
              <input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-lg font-semibold focus:border-[#0c66e4] focus:outline-none dark:border-slate-600 dark:bg-slate-800"
              />
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-[#0c66e4] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#0a5cd4] disabled:opacity-50"
              >
                Lưu
              </button>
              <button
                type="button"
                onClick={() => setEditingName(false)}
                className="rounded-lg px-2 py-1.5 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"
              >
                Huỷ
              </button>
            </form>
          ) : (
            <div className="flex flex-1 items-center gap-2">
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                {ws.name}
              </h1>
              {ws.isPersonal && (
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500 dark:bg-slate-700 dark:text-slate-300">
                  cá nhân
                </span>
              )}
              {canManage && !ws.isPersonal && (
                <button
                  type="button"
                  onClick={() => {
                    setNameDraft(ws.name);
                    setEditingName(true);
                  }}
                  className="text-xs font-medium text-[#0c66e4] hover:underline"
                >
                  Đổi tên
                </button>
              )}
            </div>
          )}
        </div>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          {members.length} thành viên · {ws.boardCount ?? wsBoards.length} bảng ·
          Vai trò của bạn: {roleLabel(myRole)}
        </p>
      </div>

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}
      {notice && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
          {notice}
        </p>
      )}

      {/* Thanh vien */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Thành viên
        </h2>

        {canManage && (
          <form onSubmit={submitInvite} className="flex gap-2">
            <input
              type="email"
              required
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Nhập địa chỉ email"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#0c66e4] focus:outline-none dark:border-slate-600 dark:bg-slate-800"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as AssignableRole)}
              className="rounded-lg border border-slate-300 px-2 py-2 text-sm focus:border-[#0c66e4] focus:outline-none dark:border-slate-600 dark:bg-slate-800"
            >
              <option value="MEMBER">Thành viên</option>
              <option value="ADMIN">Quản trị viên</option>
            </select>
            <button
              type="submit"
              disabled={busy || !inviteEmail.trim()}
              className="shrink-0 rounded-lg bg-[#0c66e4] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a5cd4] disabled:opacity-50"
            >
              Mời
            </button>
          </form>
        )}

        <ul className="flex flex-col gap-1">
          {members.map((m) => {
            const isSelf = m.userId === user?.id;
            const editable = canManage && m.role !== 'OWNER';
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700"
              >
                <Avatar
                  id={m.userId}
                  name={m.user.name}
                  avatarUrl={m.user.avatarUrl}
                  className="h-9 w-9 text-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
                    {m.user.name}
                    {isSelf && (
                      <span className="text-slate-400"> (bạn)</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                    {m.user.email}
                  </p>
                </div>

                {editable ? (
                  <select
                    value={m.role}
                    onChange={(e) =>
                      changeRole(m.userId, e.target.value as AssignableRole)
                    }
                    className="rounded-lg border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
                  >
                    <option value="MEMBER">Thành viên</option>
                    <option value="ADMIN">Quản trị viên</option>
                  </select>
                ) : (
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    {roleLabel(m.role)}
                  </span>
                )}

                {isOwner && !isSelf && m.role !== 'OWNER' && (
                  <button
                    type="button"
                    onClick={() => setTransferTarget(m)}
                    className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Chuyển quyền
                  </button>
                )}
                {editable && (
                  <button
                    type="button"
                    onClick={() => removeMember(m.userId)}
                    className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    Xoá
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Bang trong khong gian */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Bảng trong không gian ({ws.boardCount ?? wsBoards.length})
        </h2>
        {typeof ws.boardCount === 'number' && ws.boardCount > wsBoards.length && (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Có {ws.boardCount - wsBoards.length} bảng riêng tư bạn không có quyền
            xem (chỉ thành viên của bảng đó mới thấy).
          </p>
        )}
        {wsBoards.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {ws.boardCount ? 'Bạn chưa có quyền xem bảng nào.' : 'Chưa có bảng nào.'}
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {wsBoards.map((b) => (
              <li key={b.id}>
                <Link
                  to={`/boards/${b.id}`}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 p-2 hover:border-[#0c66e4] dark:border-slate-700"
                >
                  <span
                    className="h-8 w-12 shrink-0 rounded bg-cover bg-center"
                    style={
                      b.backgroundImage
                        ? { backgroundImage: `url(${assetUrl(b.backgroundImage)})` }
                        : { backgroundColor: b.color }
                    }
                  />
                  <span className="truncate text-sm font-medium text-slate-700 dark:text-slate-200">
                    {b.name}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Vung nguy hiem */}
      <section className="flex flex-col gap-2 border-t border-slate-200 pt-5 dark:border-slate-700">
        {!isOwner && (
          <button
            type="button"
            onClick={() => setConfirmLeave(true)}
            className="w-fit rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Rời khỏi không gian
          </button>
        )}
        {isOwner && !ws.isPersonal && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-fit rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Xoá không gian
          </button>
        )}
      </section>

      <ConfirmDialog
        open={transferTarget != null}
        title="Chuyển quyền sở hữu không gian"
        message={
          transferTarget
            ? `${transferTarget.user.name} sẽ trở thành chủ không gian. Bạn sẽ bị hạ xuống Quản trị viên.`
            : undefined
        }
        confirmLabel="Chuyển quyền"
        danger
        busy={busy}
        onConfirm={doTransfer}
        onCancel={() => setTransferTarget(null)}
      />
      <ConfirmDialog
        open={confirmLeave}
        title="Rời khỏi không gian?"
        message="Bạn sẽ mất quyền truy cập các bảng chia sẻ theo không gian này."
        confirmLabel="Rời khỏi"
        danger
        busy={busy}
        onConfirm={doLeave}
        onCancel={() => setConfirmLeave(false)}
      />
      <ConfirmDialog
        open={confirmDelete}
        title="Xoá không gian?"
        message={`Không gian "${ws.name}" sẽ bị xoá. Chỉ xoá được khi không còn bảng nào bên trong.`}
        confirmLabel="Xoá không gian"
        danger
        busy={busy}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
