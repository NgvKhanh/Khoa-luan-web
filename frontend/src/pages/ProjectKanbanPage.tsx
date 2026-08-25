import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import KanbanColumn from '../components/kanban/KanbanColumn';
import { fetchProjectDetail } from '../lib/api/project';
import { createTask, fetchProjectTasks, updateTask } from '../lib/api/task';
import { getErrorMessage } from '../lib/errorMessage';
import {
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type Task,
  type TaskStatus,
} from '../types/task';
import type { ProjectDetail } from '../types/project';

export default function ProjectKanbanPage() {
  const { projectId } = useParams<{ projectId: string }>();

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function loadData() {
    if (!projectId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [projectData, taskList] = await Promise.all([
        fetchProjectDetail(projectId),
        fetchProjectTasks(projectId),
      ]);
      setProject(projectData);
      setTasks(taskList);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được bảng công việc.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function handleCreateTask(e: FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setFormError(null);
    setIsCreating(true);
    try {
      await createTask(projectId, {
        title,
        assigneeId: assigneeId || undefined,
      });
      setTitle('');
      await loadData();
    } catch (err) {
      setFormError(getErrorMessage(err, 'Không tạo được công việc.'));
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    let blockedReason: string | null | undefined;
    if (newStatus === 'BLOCKED') {
      const reason = window.prompt('Nhập lý do công việc bị chặn:');
      if (!reason || !reason.trim()) return; // Huy neu khong nhap ly do
      blockedReason = reason.trim();
    }

    // Cap nhat giao dien ngay (optimistic) de keo tha muot, roi dong bo voi server
    const previousTasks = tasks;
    setTasks((current) =>
      current.map((t) =>
        t.id === taskId ? { ...t, status: newStatus, ...(blockedReason ? { blockedReason } : {}) } : t
      )
    );

    try {
      await updateTask(taskId, {
        status: newStatus,
        ...(blockedReason !== undefined ? { blockedReason } : {}),
      });
    } catch (err) {
      setTasks(previousTasks);
      setError(getErrorMessage(err, 'Không cập nhật được trạng thái công việc.'));
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-500">Đang tải...</p>;
  }

  if (error && !project) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  if (!project) {
    return <p className="text-sm text-red-600">Không tìm thấy dự án.</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-xs text-slate-400">
          <Link to={`/projects/${project.id}`} className="hover:underline">
            {project.name}
          </Link>
        </p>
        <h1 className="text-xl font-semibold text-slate-800">Bảng Kanban</h1>
      </div>

      <form
        onSubmit={handleCreateTask}
        className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-end"
      >
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Tên công việc mới
          </label>
          <input
            type="text"
            required
            minLength={2}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="w-full sm:w-56">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Người thực hiện
          </label>
          <select
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
          >
            <option value="">Chưa giao</option>
            {project.members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={isCreating}
          className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {isCreating ? 'Đang tạo...' : 'Thêm công việc'}
        </button>
      </form>
      {formError && <p className="text-sm text-red-600">{formError}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <DndContext onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {TASK_STATUSES.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              title={TASK_STATUS_LABELS[status]}
              tasks={tasks.filter((t) => t.status === status)}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
