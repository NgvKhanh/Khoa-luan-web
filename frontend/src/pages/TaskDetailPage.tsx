import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import TaskDetailBody from '../components/task/TaskDetailBody';
import type { Task } from '../types/task';

// Trang chi tiet cong viec doc lap (mo bang duong dan truc tiep /tasks/:id).
// Tren Board thi noi dung nay hien trong modal (xem components/board/CardModal).
export default function TaskDetailPage() {
  const { taskId } = useParams<{ taskId: string }>();
  const [task, setTask] = useState<Task | null>(null);

  if (!taskId) {
    return <p className="text-sm text-red-600">Không tìm thấy công việc.</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        {task && (
          <p className="text-xs text-slate-400">
            <Link
              to={`/projects/${task.projectId}/board`}
              className="hover:underline"
            >
              ← Về bảng
            </Link>
          </p>
        )}
        <h1 className="text-xl font-semibold text-slate-800">
          {task?.title ?? 'Chi tiết công việc'}
        </h1>
      </div>

      <TaskDetailBody taskId={taskId} onLoaded={setTask} />
    </div>
  );
}
