import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Link } from 'react-router-dom';
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  type Task,
} from '../../types/task';

export default function KanbanCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`cursor-grab rounded-md border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <p className="text-sm font-medium text-slate-800">{task.title}</p>
      <div className="mt-2 flex items-center justify-between">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${TASK_PRIORITY_COLORS[task.priority]}`}
        >
          {TASK_PRIORITY_LABELS[task.priority]}
        </span>
        {task.assignee && (
          <span className="text-xs text-slate-500">{task.assignee.name}</span>
        )}
      </div>
      {task.dueDate && (
        <p className="mt-1 text-xs text-slate-400">
          Hạn: {new Date(task.dueDate).toLocaleDateString('vi-VN')}
        </p>
      )}
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full bg-indigo-500"
          style={{ width: `${task.progress}%` }}
        />
      </div>
      <Link
        to={`/tasks/${task.id}`}
        onPointerDown={(e) => e.stopPropagation()}
        className="mt-2 block text-xs font-medium text-indigo-600 hover:underline"
      >
        Xem chi tiết →
      </Link>
    </div>
  );
}
