import { useEffect, useState, type FormEvent } from 'react';
import CommentSection from '../CommentSection';
import { fetchProjectDetail } from '../../lib/api/project';
import {
  createSubtask,
  deleteSubtask,
  fetchSubtasks,
  updateSubtask,
} from '../../lib/api/subtask';
import {
  addDependency,
  fetchDependencies,
  removeDependency,
} from '../../lib/api/taskDependency';
import {
  fetchProjectTasks,
  fetchTaskDetail,
  updateTask,
  type UpdateTaskInput,
} from '../../lib/api/task';
import { getErrorMessage } from '../../lib/errorMessage';
import {
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
  type Task,
  type TaskPriority,
  type TaskStatus,
} from '../../types/task';
import type { Subtask } from '../../types/subtask';
import type { TaskDependencies } from '../../types/taskDependency';
import type { ProjectDetail } from '../../types/project';

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

interface Props {
  taskId: string;
  // Goi sau moi thay doi luu thanh cong (de trang Board tai lai)
  onChanged?: () => void;
  // Bao cho cha biet task da tai xong (vi du de hien tieu de)
  onLoaded?: (task: Task) => void;
}

// Phan than chi tiet cong viec - dung chung cho trang /tasks/:id va modal tren Board.
export default function TaskDetailBody({ taskId, onChanged, onLoaded }: Props) {
  const [task, setTask] = useState<Task | null>(null);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [projectTasks, setProjectTasks] = useState<Task[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependencies | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState<UpdateTaskInput>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newDependsOnId, setNewDependsOnId] = useState('');
  const [sectionError, setSectionError] = useState<string | null>(null);

  async function loadAll() {
    setIsLoading(true);
    setError(null);
    try {
      const taskData = await fetchTaskDetail(taskId);
      setTask(taskData);
      onLoaded?.(taskData);
      setForm({
        title: taskData.title,
        description: taskData.description,
        assigneeId: taskData.assigneeId,
        status: taskData.status,
        priority: taskData.priority,
        startDate: taskData.startDate,
        dueDate: taskData.dueDate,
        progress: taskData.progress,
        estimatedHours: taskData.estimatedHours,
        actualHours: taskData.actualHours,
        blockedReason: taskData.blockedReason,
      });

      const [projectData, subtaskData, depData, taskListData] = await Promise.all([
        fetchProjectDetail(taskData.projectId),
        fetchSubtasks(taskId),
        fetchDependencies(taskId),
        fetchProjectTasks(taskData.projectId),
      ]);
      setProject(projectData);
      setSubtasks(subtaskData);
      setDependencies(depData);
      setProjectTasks(taskListData);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tải được công việc.'));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskId]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setSaveError(null);
    setSaveOk(false);
    try {
      const updated = await updateTask(taskId, form);
      setTask(updated);
      setSaveOk(true);
      onChanged?.();
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Không lưu được thay đổi.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAddSubtask(e: FormEvent) {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    setSectionError(null);
    try {
      const subtask = await createSubtask(taskId, newSubtaskTitle.trim());
      setSubtasks((prev) => [...prev, subtask]);
      setNewSubtaskTitle('');
    } catch (err) {
      setSectionError(getErrorMessage(err, 'Không thêm được công việc con.'));
    }
  }

  async function handleToggleSubtask(subtask: Subtask) {
    setSectionError(null);
    try {
      const updated = await updateSubtask(subtask.id, { isDone: !subtask.isDone });
      setSubtasks((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (err) {
      setSectionError(getErrorMessage(err, 'Không cập nhật được công việc con.'));
    }
  }

  async function handleDeleteSubtask(subtaskId: string) {
    setSectionError(null);
    try {
      await deleteSubtask(subtaskId);
      setSubtasks((prev) => prev.filter((s) => s.id !== subtaskId));
    } catch (err) {
      setSectionError(getErrorMessage(err, 'Không xoá được công việc con.'));
    }
  }

  async function handleAddDependency(e: FormEvent) {
    e.preventDefault();
    if (!newDependsOnId) return;
    setSectionError(null);
    try {
      await addDependency(taskId, newDependsOnId);
      setDependencies(await fetchDependencies(taskId));
      setNewDependsOnId('');
    } catch (err) {
      setSectionError(getErrorMessage(err, 'Không thêm được quan hệ phụ thuộc.'));
    }
  }

  async function handleRemoveDependency(dependencyId: string) {
    setSectionError(null);
    try {
      await removeDependency(dependencyId);
      setDependencies(await fetchDependencies(taskId));
    } catch (err) {
      setSectionError(getErrorMessage(err, 'Không xoá được quan hệ phụ thuộc.'));
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-500">Đang tải...</p>;
  }

  if (error || !task) {
    return (
      <p className="text-sm text-red-600">
        {error ?? 'Không tìm thấy công việc.'}
      </p>
    );
  }

  const dependableTasks = projectTasks.filter(
    (t) =>
      t.id !== task.id &&
      !dependencies?.blockedBy.some((d) => d.dependsOnTaskId === t.id)
  );

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={handleSave}
        className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-4"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Tên công việc
          </label>
          <input
            type="text"
            required
            minLength={2}
            value={form.title ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Mô tả</label>
          <textarea
            value={form.description ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Người thực hiện
            </label>
            <select
              value={form.assigneeId ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, assigneeId: e.target.value || null }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              <option value="">Chưa giao</option>
              {project?.members.map((m) => (
                <option key={m.userId} value={m.userId}>
                  {m.user.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Trạng thái
            </label>
            <select
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as TaskStatus }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {TASK_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Mức ưu tiên
            </label>
            <select
              value={form.priority}
              onChange={(e) =>
                setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            >
              {(Object.keys(TASK_PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                <option key={p} value={p}>
                  {TASK_PRIORITY_LABELS[p]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Tiến độ ({form.progress ?? 0}%)
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={form.progress ?? 0}
              onChange={(e) =>
                setForm((f) => ({ ...f, progress: Number(e.target.value) }))
              }
              className="w-full"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Ngày bắt đầu
            </label>
            <input
              type="date"
              value={toDateInputValue(form.startDate ?? null)}
              onChange={(e) =>
                setForm((f) => ({ ...f, startDate: e.target.value || null }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Deadline
            </label>
            <input
              type="date"
              value={toDateInputValue(form.dueDate ?? null)}
              onChange={(e) =>
                setForm((f) => ({ ...f, dueDate: e.target.value || null }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Số giờ dự kiến
            </label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={form.estimatedHours ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  estimatedHours: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Số giờ thực tế
            </label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={form.actualHours ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  actualHours: e.target.value === '' ? null : Number(e.target.value),
                }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {form.status === 'BLOCKED' && (
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Lý do bị chặn
            </label>
            <input
              type="text"
              required
              value={form.blockedReason ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, blockedReason: e.target.value }))
              }
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        )}

        {saveError && <p className="text-sm text-red-600">{saveError}</p>}
        {saveOk && <p className="text-sm text-emerald-600">Đã lưu thay đổi.</p>}

        <button
          type="submit"
          disabled={isSaving}
          className="self-start rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
        </button>
      </form>

      {sectionError && <p className="text-sm text-red-600">{sectionError}</p>}

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Công việc con</h2>
        <ul className="mb-3 flex flex-col gap-2">
          {subtasks.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={s.isDone}
                onChange={() => handleToggleSubtask(s)}
              />
              <span
                className={
                  s.isDone
                    ? 'flex-1 text-slate-400 line-through'
                    : 'flex-1 text-slate-700'
                }
              >
                {s.title}
              </span>
              <button
                type="button"
                onClick={() => handleDeleteSubtask(s.id)}
                className="text-xs font-medium text-red-600 hover:underline"
              >
                Xoá
              </button>
            </li>
          ))}
          {subtasks.length === 0 && (
            <li className="text-sm text-slate-400">Chưa có công việc con.</li>
          )}
        </ul>
        <form onSubmit={handleAddSubtask} className="flex gap-2">
          <input
            type="text"
            value={newSubtaskTitle}
            onChange={(e) => setNewSubtaskTitle(e.target.value)}
            placeholder="Thêm công việc con..."
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Thêm
          </button>
        </form>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Quan hệ phụ thuộc</h2>

        <div className="mb-3">
          <p className="mb-1 text-xs font-medium text-slate-500">
            Công việc này đang chờ (blocked by):
          </p>
          {dependencies?.blockedBy.length ? (
            <ul className="flex flex-col gap-1">
              {dependencies.blockedBy.map((d) => (
                <li key={d.id} className="flex items-center justify-between text-sm">
                  <span>
                    {d.dependsOnTask.title} —{' '}
                    <span className="text-slate-400">
                      {TASK_STATUS_LABELS[d.dependsOnTask.status]}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveDependency(d.id)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Xoá
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Không có.</p>
          )}
        </div>

        <div className="mb-3">
          <p className="mb-1 text-xs font-medium text-slate-500">
            Công việc khác đang chờ việc này (blocking):
          </p>
          {dependencies?.blocking.length ? (
            <ul className="flex flex-col gap-1">
              {dependencies.blocking.map((d) => (
                <li key={d.id} className="text-sm">
                  {d.task.title} —{' '}
                  <span className="text-slate-400">
                    {TASK_STATUS_LABELS[d.task.status]}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Không có.</p>
          )}
        </div>

        <form onSubmit={handleAddDependency} className="flex gap-2">
          <select
            value={newDependsOnId}
            onChange={(e) => setNewDependsOnId(e.target.value)}
            className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          >
            <option value="">Chọn công việc phải hoàn thành trước...</option>
            {dependableTasks.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={!newDependsOnId}
            className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            Thêm
          </button>
        </form>
      </div>

      <CommentSection taskId={task.id} />
    </div>
  );
}
