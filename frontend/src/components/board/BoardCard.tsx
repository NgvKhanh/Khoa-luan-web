import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { initialsOf } from '../../lib/avatar';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type Task,
} from '../../types/task';

interface Props {
  task: Task;
  onOpen: (taskId: string) => void;
}

// 1 the (card) tren bang. Vua keo tha duoc (useSortable), vua bam mo chi tiet.
export default function BoardCard({ task, onOpen }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id, data: { type: 'card', listId: task.listId } });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task.id)}
      className={`cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors hover:border-blue-400 ${
        isDragging ? 'opacity-40' : ''
      }`}
    >
      <p className="font-medium text-slate-800">{task.title}</p>

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${TASK_PRIORITY_COLORS[task.priority]}`}
        >
          {TASK_PRIORITY_LABELS[task.priority]}
        </span>
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-500">
          {TASK_STATUS_LABELS[task.status]}
        </span>
        {task.dueDate && (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-700">
            {new Date(task.dueDate).toLocaleDateString('vi-VN')}
          </span>
        )}
      </div>

      {task.progress > 0 && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-blue-500"
            style={{ width: `${task.progress}%` }}
          />
        </div>
      )}

      {task.assignee && (
        <div className="mt-1.5 flex justify-end">
          <span
            title={task.assignee.name}
            className="grid h-6 w-6 place-items-center rounded-full bg-slate-200 text-[11px] font-semibold text-slate-600"
          >
            {initialsOf(task.assignee.name)}
          </span>
        </div>
      )}
    </div>
  );
}
