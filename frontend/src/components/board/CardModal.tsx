import { useEffect, useState } from 'react';
import TaskDetailBody from '../task/TaskDetailBody';
import type { Task } from '../../types/task';

interface Props {
  taskId: string;
  onClose: () => void;
  onChanged?: () => void;
}

// Cua so noi (modal) hien chi tiet 1 the, de len tren Board - giong Trello.
export default function CardModal({ taskId, onClose, onChanged }: Props) {
  const [task, setTask] = useState<Task | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden'; // khoa cuon nen phia sau
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center overflow-y-auto bg-black/50 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="my-auto w-full max-w-2xl rounded-xl bg-slate-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <h2 className="text-base font-semibold text-slate-800">
            {task?.title ?? 'Chi tiết công việc'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
            aria-label="Đóng"
          >
            <span className="text-xl leading-none">×</span>
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-5">
          <TaskDetailBody
            taskId={taskId}
            onLoaded={setTask}
            onChanged={onChanged}
          />
        </div>
      </div>
    </div>
  );
}
