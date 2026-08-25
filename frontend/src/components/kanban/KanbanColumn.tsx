import { useDroppable } from '@dnd-kit/core';
import type { Task, TaskStatus } from '../../types/task';
import KanbanCard from './KanbanCard';

interface KanbanColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
}

export default function KanbanColumn({ status, title, tasks }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-72 shrink-0 flex-col rounded-lg border bg-slate-50 p-3 ${
        isOver ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200'
      }`}
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-600">
          {tasks.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2">
        {tasks.map((task) => (
          <KanbanCard key={task.id} task={task} />
        ))}
        {tasks.length === 0 && (
          <p className="px-1 text-xs text-slate-400">Không có công việc</p>
        )}
      </div>
    </div>
  );
}
