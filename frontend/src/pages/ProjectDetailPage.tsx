import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  addProjectMember,
  deleteProject,
  fetchProjectDetail,
  removeProjectMember,
  updateProjectMemberRole,
} from '../lib/api/project';
import { getErrorMessage } from '../lib/errorMessage';
import type { ProjectDetail } from '../types/project';

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadProject() {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchProjectDetail(projectId);
      setProject(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được thông tin dự án.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadProject();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const myMembership = project?.members.find((m) => m.userId === user?.id);
  const isManager = myMembership?.role === 'MANAGER';

  async function handleAddMember(e: FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setActionError(null);
    setIsSubmitting(true);
    try {
      await addProjectMember(projectId, newMemberEmail);
      setNewMemberEmail('');
      await loadProject();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Không thêm được thành viên.'));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRemoveMember(userId: string) {
    if (!projectId) return;
    setActionError(null);
    try {
      await removeProjectMember(projectId, userId);
      await loadProject();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Không xoá được thành viên.'));
    }
  }

  async function handleToggleRole(userId: string, currentRole: string) {
    if (!projectId) return;
    setActionError(null);
    try {
      await updateProjectMemberRole(
        projectId,
        userId,
        currentRole === 'MANAGER' ? 'MEMBER' : 'MANAGER'
      );
      await loadProject();
    } catch (err) {
      setActionError(getErrorMessage(err, 'Không cập nhật được vai trò.'));
    }
  }

  async function handleDeleteProject() {
    if (!projectId) return;
    if (
      !window.confirm('Xoá dự án này? Toàn bộ công việc thuộc dự án cũng sẽ bị xoá.')
    ) {
      return;
    }
    try {
      await deleteProject(projectId);
      navigate('/projects', { replace: true });
    } catch (err) {
      setActionError(getErrorMessage(err, 'Không xoá được dự án.'));
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-500">Đang tải...</p>;
  }

  if (error || !project) {
    return (
      <p className="text-sm text-red-600">
        {error ?? 'Không tìm thấy dự án.'}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-slate-400">
            <Link to="/teams" className="hover:underline">
              Nhóm
            </Link>{' '}
            / {project.team.name}
          </p>
          <h1 className="text-xl font-semibold text-slate-800">
            {project.name}
          </h1>
          {project.description && (
            <p className="mt-1 text-sm text-slate-500">{project.description}</p>
          )}
        </div>
        {isManager && (
          <button
            type="button"
            onClick={handleDeleteProject}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Xoá dự án
          </button>
        )}
      </div>

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {isManager && (
        <form
          onSubmit={handleAddMember}
          className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Thêm thành viên bằng email (phải đã là thành viên nhóm)
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
              {isManager && <th className="px-4 py-2 font-medium">Hành động</th>}
            </tr>
          </thead>
          <tbody>
            {project.members.map((member) => (
              <tr key={member.id} className="border-t border-slate-100">
                <td className="px-4 py-2 text-slate-800">{member.user.name}</td>
                <td className="px-4 py-2 text-slate-500">{member.user.email}</td>
                <td className="px-4 py-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      member.role === 'MANAGER'
                        ? 'bg-indigo-50 text-indigo-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {member.role === 'MANAGER' ? 'Quản lý' : 'Thành viên'}
                  </span>
                </td>
                {isManager && (
                  <td className="space-x-3 px-4 py-2">
                    <button
                      type="button"
                      onClick={() => handleToggleRole(member.userId, member.role)}
                      className="text-xs font-medium text-indigo-600 hover:underline"
                    >
                      {member.role === 'MANAGER'
                        ? 'Hạ xuống thành viên'
                        : 'Đặt làm quản lý'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.userId)}
                      className="text-xs font-medium text-red-600 hover:underline"
                    >
                      Xoá khỏi dự án
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
