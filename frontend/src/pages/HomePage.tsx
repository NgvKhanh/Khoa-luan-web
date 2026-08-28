import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import BoardTile from '../components/BoardTile';
import { fetchMyTeams } from '../lib/api/team';
import {
  createProject,
  fetchMyProjects,
  setProjectStar,
} from '../lib/api/project';
import { colorForId, initialsOf } from '../lib/avatar';
import { getErrorMessage } from '../lib/errorMessage';
import { getRecentBoards } from '../lib/recentBoards';
import type { TeamListItem } from '../types/team';
import type { ProjectListItem } from '../types/project';

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
      className="flex h-24 flex-col justify-between rounded-lg bg-slate-200 p-2"
    >
      <input
        autoFocus
        type="text"
        value={name}
        disabled={isSubmitting}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={submit}
        placeholder="Nhập tên bảng..."
        className="rounded border border-slate-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      {!error && (
        <div className="flex gap-2 text-xs">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded bg-blue-600 px-2 py-1 font-medium text-white hover:bg-blue-700"
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

function SectionHeading({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
      <span className="text-slate-400">{icon}</span>
      {children}
    </h2>
  );
}

const gridClass =
  'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';

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

  async function handleToggleStar(projectId: string, next: boolean) {
    setProjects((prev) =>
      prev.map((p) => (p.id === projectId ? { ...p, isStarred: next } : p))
    );
    try {
      await setProjectStar(projectId, next);
    } catch (err) {
      // Hoan tac neu loi
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, isStarred: !next } : p))
      );
      setError(getErrorMessage(err, 'Không cập nhật được đánh dấu sao.'));
    }
  }

  const starred = useMemo(
    () => projects.filter((p) => p.isStarred),
    [projects]
  );

  const recent = useMemo(() => {
    const byId = new Map(projects.map((p) => [p.id, p]));
    return getRecentBoards()
      .map((r) => byId.get(r.id))
      .filter((p): p is ProjectListItem => Boolean(p))
      .slice(0, 4);
  }, [projects]);

  if (isLoading) {
    return <p className="text-sm text-slate-500">Đang tải...</p>;
  }

  if (error && projects.length === 0) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-9">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {teams.length === 0 && (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center">
          <p className="text-sm text-slate-600">
            Bạn chưa có không gian làm việc (workspace) nào.
          </p>
          <Link
            to="/teams"
            className="mt-2 inline-block text-sm font-medium text-blue-600 hover:underline"
          >
            Tạo nhóm đầu tiên →
          </Link>
        </div>
      )}

      {starred.length > 0 && (
        <section>
          <SectionHeading
            icon={
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17.9 6.8 20.6l1-5.8-4.3-4.1 5.9-.9z" />
              </svg>
            }
          >
            Bảng đánh dấu sao
          </SectionHeading>
          <div className={gridClass}>
            {starred.map((p) => (
              <BoardTile
                key={p.id}
                id={p.id}
                name={p.name}
                memberCount={p.memberCount}
                isStarred={p.isStarred}
                onToggleStar={(next) => handleToggleStar(p.id, next)}
              />
            ))}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section>
          <SectionHeading
            icon={
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 fill-none stroke-current"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
            }
          >
            Đã xem gần đây
          </SectionHeading>
          <div className={gridClass}>
            {recent.map((p) => (
              <BoardTile
                key={p.id}
                id={p.id}
                name={p.name}
                memberCount={p.memberCount}
                isStarred={p.isStarred}
                onToggleStar={(next) => handleToggleStar(p.id, next)}
              />
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionHeading
          icon={
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4 fill-none stroke-current"
              strokeWidth="2"
            >
              <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
            </svg>
          }
        >
          Các không gian làm việc của bạn
        </SectionHeading>

        <div className="flex flex-col gap-8">
          {teams.map((team) => {
            const teamProjects = projects.filter((p) => p.team.id === team.id);
            const isCreatingHere = creatingForTeamId === team.id;

            return (
              <div key={team.id}>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded text-xs font-bold text-white"
                    style={{ backgroundColor: colorForId(team.id) }}
                  >
                    {initialsOf(team.name)}
                  </span>
                  <span className="font-semibold text-slate-700">{team.name}</span>
                  <div className="flex items-center gap-2 text-xs">
                    <Link
                      to={`/teams/${team.id}`}
                      className="rounded border border-slate-300 bg-white px-2 py-1 font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Thành viên
                    </Link>
                    <Link
                      to={`/teams/${team.id}`}
                      className="rounded border border-slate-300 bg-white px-2 py-1 font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Cài đặt
                    </Link>
                  </div>
                </div>

                <div className={gridClass}>
                  {teamProjects.map((project) => (
                    <BoardTile
                      key={project.id}
                      id={project.id}
                      name={project.name}
                      memberCount={project.memberCount}
                      isStarred={project.isStarred}
                      onToggleStar={(next) => handleToggleStar(project.id, next)}
                    />
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
                      className="flex h-24 flex-col items-center justify-center gap-1 rounded-lg bg-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-300"
                    >
                      <span className="text-lg leading-none">+</span>
                      Tạo bảng mới
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
