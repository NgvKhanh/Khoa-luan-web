import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyTeams } from '../lib/api/team';
import { createProject, fetchMyProjects } from '../lib/api/project';
import { getErrorMessage } from '../lib/errorMessage';
import type { TeamListItem } from '../types/team';
import type { ProjectListItem } from '../types/project';

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [teamId, setTeamId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    try {
      const [projectList, teamList] = await Promise.all([
        fetchMyProjects(),
        fetchMyTeams(),
      ]);
      setProjects(projectList);
      setTeams(teamList);
      setTeamId((current) => current || teamList[0]?.id || '');
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được danh sách dự án.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    if (!teamId) {
      setFormError('Bạn cần có ít nhất 1 nhóm trước khi tạo dự án.');
      return;
    }

    setIsCreating(true);
    try {
      await createProject({
        teamId,
        name,
        description: description.trim() || undefined,
      });
      setName('');
      setDescription('');
      await loadData();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Không tạo được dự án.'));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Dự án của tôi</h1>
        <p className="mt-1 text-sm text-slate-500">
          Danh sách các dự án bạn đang tham gia.
        </p>
      </div>

      {!isLoading && teams.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Bạn chưa có nhóm nào. Hãy{' '}
          <Link to="/teams" className="font-medium underline">
            tạo một nhóm
          </Link>{' '}
          trước khi tạo dự án.
        </p>
      ) : (
        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Nhóm
            </label>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            >
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Tên dự án
            </label>
            <input
              type="text"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Mô tả (tuỳ chọn)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isCreating}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
          >
            {isCreating ? 'Đang tạo...' : 'Tạo dự án'}
          </button>
        </form>
      )}
      {formError && <p className="text-sm text-red-600">{formError}</p>}

      {isLoading && <p className="text-sm text-slate-500">Đang tải...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!isLoading && !error && projects.length === 0 && (
        <p className="text-sm text-slate-500">Bạn chưa có dự án nào.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <Link
            key={project.id}
            to={`/projects/${project.id}`}
            className="rounded-lg border border-slate-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-slate-800">{project.name}</h2>
              {project.myRole === 'MANAGER' && (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  Quản lý
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              Nhóm: {project.team.name}
            </p>
            {project.description && (
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                {project.description}
              </p>
            )}
            <p className="mt-2 text-xs text-slate-400">
              {project.memberCount} thành viên
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
