import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchProjectDetail } from '../lib/api/project';
import { fetchProjectTasksPaged, type TaskListQuery } from '../lib/api/task';
import { getErrorMessage } from '../lib/errorMessage';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from '../types/task';
import type { ProjectDetail } from '../types/project';

const PAGE_SIZE = 10;

export default function ProjectTaskListPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<TaskStatus | ''>('');
  const [priority, setPriority] = useState<TaskPriority | ''>('');
  const [assigneeId, setAssigneeId] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!projectId) return;
    fetchProjectDetail(projectId)
      .then(setProject)
      .catch((err) => setError(getErrorMessage(err, 'Không tải được dự án.')));
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    const query: TaskListQuery = {
      search: search.trim() || undefined,
      status: status || undefined,
      priority: priority || undefined,
      assigneeId: assigneeId || undefined,
      sortBy: 'dueDate',
      sortOrder,
      page,
      pageSize: PAGE_SIZE,
    };

    fetchProjectTasksPaged(projectId, query)
      .then((result) => {
        setTasks(result.tasks);
        setTotal(result.pagination.total);
        setTotalPages(result.pagination.totalPages);
      })
      .catch((err) => setError(getErrorMessage(err, 'Không tải được danh sách công việc.')))
      .finally(() => setIsLoading(false));
  }, [projectId, search, status, priority, assigneeId, sortOrder, page]);

  // Moi khi doi bo loc, quay ve trang 1
  function updateFilter(fn: () => void) {
    fn();
    setPage(1);
  }

  if (!project && error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        {project && (
          <p className="text-xs text-slate-400">
            <Link to={`/projects/${project.id}`} className="hover:underline">
              {project.name}
            </Link>
          </p>
        )}
        <h1 className="text-xl font-semibold text-slate-800">Danh sách công việc</h1>
      </div>

      <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 bg-white p-3">
        <input
          type="text"
          placeholder="Tìm theo tên công việc..."
          value={search}
          onChange={(e) => updateFilter(() => setSearch(e.target.value))}
          className="min-w-[200px] flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <select
          value={status}
          onChange={(e) => updateFilter(() => setStatus(e.target.value as TaskStatus | ''))}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Tất cả trạng thái</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          value={priority}
          onChange={(e) => updateFilter(() => setPriority(e.target.value as TaskPriority | ''))}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Tất cả mức ưu tiên</option>
          {(Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((p) => (
            <option key={p} value={p}>
              {TASK_PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        <select
          value={assigneeId}
          onChange={(e) => updateFilter(() => setAssigneeId(e.target.value))}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        >
          <option value="">Tất cả người thực hiện</option>
          {project?.members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.user.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => updateFilter(() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc'))}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          Deadline {sortOrder === 'asc' ? '↑ gần nhất' : '↓ xa nhất'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {isLoading && <p className="text-sm text-slate-500">Đang tải...</p>}

      {!isLoading && tasks.length === 0 && (
        <p className="text-sm text-slate-500">Không có công việc nào khớp bộ lọc.</p>
      )}

      {!isLoading && tasks.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Tên công việc</th>
                <th className="px-4 py-2 font-medium">Trạng thái</th>
                <th className="px-4 py-2 font-medium">Ưu tiên</th>
                <th className="px-4 py-2 font-medium">Người thực hiện</th>
                <th className="px-4 py-2 font-medium">Deadline</th>
                <th className="px-4 py-2 font-medium">Tiến độ</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-800">{task.title}</td>
                  <td className="px-4 py-2 text-slate-600">
                    {TASK_STATUS_LABELS[task.status]}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${TASK_PRIORITY_COLORS[task.priority]}`}
                    >
                      {TASK_PRIORITY_LABELS[task.priority]}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {task.assignee?.name ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-slate-600">
                    {task.dueDate
                      ? new Date(task.dueDate).toLocaleDateString('vi-VN')
                      : '—'}
                  </td>
                  <td className="px-4 py-2 text-slate-600">{task.progress}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>
            Trang {page}/{totalPages} — {total} công việc
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40"
            >
              Trước
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-slate-300 px-3 py-1.5 disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
