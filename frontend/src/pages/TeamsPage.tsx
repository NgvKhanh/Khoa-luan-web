import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { createTeam, fetchMyTeams } from '../lib/api/team';
import { getErrorMessage } from '../lib/errorMessage';
import type { TeamListItem } from '../types/team';

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadTeams() {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchMyTeams();
      setTeams(data);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được danh sách nhóm.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTeams();
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setIsCreating(true);

    try {
      await createTeam({
        name,
        description: description.trim() || undefined,
      });
      setName('');
      setDescription('');
      await loadTeams();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Không tạo được nhóm.'));
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-800">Nhóm của tôi</h1>
        <p className="mt-1 text-sm text-slate-500">
          Danh sách các nhóm bạn đang tham gia.
        </p>
      </div>

      <form
        onSubmit={handleCreate}
        className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Tên nhóm
          </label>
          <input
            type="text"
            required
            minLength={2}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="Ví dụ: Nhóm khoá luận"
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
          {isCreating ? 'Đang tạo...' : 'Tạo nhóm'}
        </button>
      </form>
      {formError && <p className="text-sm text-red-600">{formError}</p>}

      {isLoading && <p className="text-sm text-slate-500">Đang tải...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!isLoading && !error && teams.length === 0 && (
        <p className="text-sm text-slate-500">
          Bạn chưa tham gia nhóm nào. Hãy tạo nhóm mới ở trên.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {teams.map((team) => (
          <Link
            key={team.id}
            to={`/teams/${team.id}`}
            className="rounded-lg border border-slate-200 bg-white p-4 hover:border-indigo-300 hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-medium text-slate-800">{team.name}</h2>
              {team.myRole === 'LEADER' && (
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700">
                  Trưởng nhóm
                </span>
              )}
            </div>
            {team.description && (
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">
                {team.description}
              </p>
            )}
            <p className="mt-2 text-xs text-slate-400">
              {team.memberCount} thành viên
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
