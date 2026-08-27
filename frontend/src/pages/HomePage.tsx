import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyTeams } from '../lib/api/team';
import { createProject, fetchMyProjects } from '../lib/api/project';
import { getErrorMessage } from '../lib/errorMessage';
import type { TeamListItem } from '../types/team';
import type { ProjectListItem } from '../types/project';

// Bang mau kieu Trello: moi "board" duoc gan 1 mau nen dac dua tren id,
// nen mau on dinh qua moi lan tai lai trang (khong random moi render).
const BOARD_COLORS = [
  '#0079BF',
  '#D29034',
  '#519839',
  '#B04632',
  '#89609E',
  '#CD5A91',
  '#4BBF6B',
  '#00AECC',
  '#838C91',
  '#172B4D',
];

function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) % BOARD_COLORS.length;
  }
  return BOARD_COLORS[hash]!;
}

function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

interface NewBoardTileProps {
  teamId: string;
  onCreated: () => void;
  onCancel: () => void;
}

function NewBoardTile({ teamId, onCreated, onCancel }: NewBoardTileProps) {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!name.trim()) {
      onCancel();
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await createProject({ teamId, name: name.trim() });
      onCreated();
    } catch (err) {
      setError(getErrorMessage(err, 'Không tạo được bảng.'));
      setIsSubmitting(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') onCancel();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex h-24 flex-col justify-between rounded-lg bg-slate-100 p-3"
    >
      <input
        autoFocus
        type="text"
        value={name}
        disabled={isSubmitting}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={submit}
        placeholder="Tên bảng..."
        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!error && (
        <div className="flex gap-2 text-xs">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-indigo-600 px-2 py-1 font-medium text-white hover:bg-indigo-700"
          >
            Tạo
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={onCancel}
            className="px-2 py-1 text-slate-500 hover:text-slate-700"
          >
            Huỷ
          </button>
        </div>
      )}
    </form>
  );
}

export default function HomePage() {
  const [teams, setTeams] = useState<TeamListItem[]>([]);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creatingForTeamId, setCreatingForTeamId] = useState<string | null>(null);

  async function loadAll() {
    setIsLoading(true);
    setError(null);
    try {
      const [teamList, projectList] = await Promise.all([
        fetchMyTeams(),
        fetchMyProjects(),
      ]);
      setTeams(teamList);
      setProjects(projectList);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được trang chủ.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  if (isLoading) {
    return <p className="text-sm text-slate-500">Đang tải...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      {teams.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
          <p className="text-sm text-slate-600">
            Bạn chưa có không gian làm việc (workspace) nào.
          </p>
          <Link
            to="/teams"
            className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:underline"
          >
            Tạo nhóm đầu tiên →
          </Link>
        </div>
      )}

      {teams.map((team) => {
        const teamProjects = projects.filter((p) => p.team.id === team.id);
        const isCreatingHere = creatingForTeamId === team.id;

        return (
          <section key={team.id}>
            <div className="mb-3 flex items-center gap-2">
              <span
                className="flex h-8 w-8 items-center justify-center rounded text-xs font-bold text-white"
                style={{ backgroundColor: colorForId(team.id) }}
              >
                {initialsOf(team.name)}
              </span>
              <Link
                to={`/teams/${team.id}`}
                className="text-sm font-semibold text-slate-700 hover:text-indigo-600"
              >
                {team.name}
              </Link>
              <span className="text-xs text-slate-400">
                {team.memberCount} thành viên
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {teamProjects.map((project) => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}/kanban`}
                  className="flex h-24 flex-col justify-between rounded-lg p-3 text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md"
                  style={{ backgroundColor: colorForId(project.id) }}
                >
                  <span className="font-semibold leading-snug line-clamp-2">
                    {project.name}
                  </span>
                  <span className="text-xs text-white/80">
                    {project.memberCount} thành viên
                  </span>
                </Link>
              ))}

              {isCreatingHere ? (
                <NewBoardTile
                  teamId={team.id}
                  onCreated={() => {
                    setCreatingForTeamId(null);
                    loadAll();
                  }}
                  onCancel={() => setCreatingForTeamId(null)}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setCreatingForTeamId(team.id)}
                  className="flex h-24 flex-col items-center justify-center gap-1 rounded-lg bg-slate-100 text-sm font-medium text-slate-500 hover:bg-slate-200"
                >
                  <span className="text-lg leading-none">+</span>
                  Tạo bảng mới
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
