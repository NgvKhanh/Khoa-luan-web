import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  addTeamMember,
  deleteTeam,
  fetchTeamDetail,
  removeTeamMember,
  updateMemberRole,
} from '../lib/api/team';
import { getErrorMessage } from '../lib/errorMessage';
import type { TeamDetail } from '../types/team';

export default function TeamDetailPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [team, setTeam] = useState<TeamDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadTeam() {
    if (!teamId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchTeamDetail(teamId);
      setTeam(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được thông tin nhóm.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTeam();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const myMembership = team?.members.find((m) => m.userId === user?.id);
  const isLeader = myMembership?.role === 'LEADER';

  async function handleAddMember(e: FormEvent) {
    e.preventDefault();
    if (!teamId) return;
    setActionError(null);
    setIsSubmitting(true);
    try {
      await addTeamMember(teamId, newMemberEmail);
      setNewMemberEmail('');
      await loadTeam();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Không thêm được thành viên.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!teamId) return;
    setActionError(null);
    try {
      await removeTeamMember(teamId, userId);
      await loadTeam();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Không xoá được thành viên.'));
    }
  }

  async function handleToggleRole(userId: string, currentRole: string) {
    if (!teamId) return;
    setActionError(null);
    try {
      await updateMemberRole(
        teamId,
        userId,
        currentRole === 'LEADER' ? 'MEMBER' : 'LEADER'
      );
      await loadTeam();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Không cập nhật được vai trò.'));
    }
  }

  async function handleDeleteTeam() {
    if (!teamId) return;
    if (!window.confirm('Xoá nhóm này? Các dự án thuộc nhóm cũng sẽ bị xoá.')) {
      return;
    }
    try {
      await deleteTeam(teamId);
      navigate('/teams', { replace: true });
    } catch (err) {
      setActionError(getErrorMessage(err, 'Không xoá được nhóm.'));
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-500">Đang tải...</p>;
  }

  if (error || !team) {
    return (
      <p className="text-sm text-red-600">
        {error ?? 'Không tìm thấy nhóm.'}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">{team.name}</h1>
          {team.description && (
            <p className="mt-1 text-sm text-slate-500">{team.description}</p>
          )}
        </div>
        {isLeader && (
          <button
            type="button"
            onClick={handleDeleteTeam}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Xoá nhóm
          </button>
        )}
      </div>

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {isLeader && (
        <form
          onSubmit={handleAddMember}
          className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Thêm thành viên bằng email
            </label>
            <input
              type="email"
              required
              value={newMemberEmail}
              onChange={(e) => setNewMemberEmail(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="email@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {isSubmitting ? 'Đang thêm...' : 'Thêm'}
          </button>
        </form>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Tên</th>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Vai trò</th>
              {isLeader && <th className="px-4 py-2 font-medium">Hành động</th>}
            </tr>
          </thead>
          <tbody>
            {team.members.map((member) => (
              <tr key={member.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-800">{member.user.name}</td>
                <td className="px-4 py-2 text-slate-500">{member.user.email}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      member.role === 'LEADER'
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {member.role === 'LEADER' ? 'Trưởng nhóm' : 'Thành viên'}
                  </span>
                </td>
                {isLeader && (
                  <td className="space-x-3 px-4 py-2">
                    <button
                      type="button"
                      onClick={() => handleToggleRole(member.userId, member.role)}
                      className="text-xs font-medium text-indigo-600 hover:underline"
                    >
                      {member.role === 'LEADER'
                        ? 'Hạ xuống thành viên'
                        : 'Đặt làm trưởng nhóm'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.userId)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Xoá khỏi nhóm
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
