import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import Avatar from '../Avatar';
import type { BoardList } from '../../types/list';

interface Props {
  lists: BoardList[];
  onClose: () => void;
}

function Bar({ pct, className }: { pct: number; className?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
      <div
        className={`h-full rounded-full ${className ?? 'bg-[#0c66e4]'}`}
        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}

export default function BoardStatsPanel({ lists, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (ref.current && !ref.current.contains(t) && !t.closest('[data-stats-trigger]')) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const stats = useMemo(() => {
    const now = Date.now();
    let total = 0;
    let done = 0;
    let overdue = 0;
    const byList = lists.map((l) => ({
      name: l.name,
      total: l.cards.length,
      done: l.cards.filter((c) => c.isDone).length,
    }));
    const memberCount = new Map<string, { name: string; avatarUrl: string | null; count: number }>();

    for (const l of lists) {
      for (const c of l.cards) {
        total += 1;
        if (c.isDone) done += 1;
        else if (c.dueDate && new Date(c.dueDate).getTime() < now) overdue += 1;
        for (const m of c.members ?? []) {
          const cur = memberCount.get(m.userId);
          if (cur) cur.count += 1;
          else
            memberCount.set(m.userId, {
              name: m.user.name,
              avatarUrl: m.user.avatarUrl,
              count: 1,
            });
        }
      }
    }

    const topMembers = [...memberCount.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8);

    return { total, done, overdue, byList, topMembers };
  }, [lists]);

  const donePct = stats.total > 0 ? (stats.done / stats.total) * 100 : 0;

  return createPortal(
    <div
      ref={ref}
      className="fixed right-3 top-14 z-50 max-h-[80vh] w-96 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 text-slate-800 shadow-2xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
    >
      <p className="mb-3 text-center text-sm font-semibold">Thống kê tiến độ</p>

      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-900">
          <p className="text-lg font-bold">{stats.total}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Tổng số thẻ</p>
        </div>
        <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-900">
          <p className="text-lg font-bold text-emerald-600">{stats.done}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Hoàn thành</p>
        </div>
        <div className="rounded-lg bg-slate-50 py-2 dark:bg-slate-900">
          <p className="text-lg font-bold text-red-600">{stats.overdue}</p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">Quá hạn</p>
        </div>
      </div>

      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
          <span>Tiến độ chung</span>
          <span>{donePct.toFixed(0)}%</span>
        </div>
        <Bar pct={donePct} className="bg-emerald-500" />
      </div>

      <div className="mb-4">
        <p className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
          Theo danh sách
        </p>
        <div className="flex flex-col gap-2">
          {stats.byList.map((l) => (
            <div key={l.name}>
              <div className="mb-0.5 flex items-center justify-between text-xs">
                <span className="truncate text-slate-700 dark:text-slate-200">{l.name}</span>
                <span className="shrink-0 text-slate-400">
                  {l.done}/{l.total}
                </span>
              </div>
              <Bar pct={l.total > 0 ? (l.done / l.total) * 100 : 0} />
            </div>
          ))}
          {stats.byList.length === 0 && (
            <p className="text-xs text-slate-400">Chưa có danh sách nào.</p>
          )}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
          Theo thành viên
        </p>
        {stats.topMembers.length === 0 ? (
          <p className="text-xs text-slate-400">Chưa có thẻ nào được gán.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {stats.topMembers.map(([userId, m]) => (
              <div key={userId} className="flex items-center gap-2 text-sm">
                <Avatar id={userId} name={m.name} avatarUrl={m.avatarUrl} className="h-6 w-6 text-[10px]" />
                <span className="min-w-0 flex-1 truncate text-slate-700 dark:text-slate-200">
                  {m.name}
                </span>
                <span className="text-xs text-slate-400">{m.count} thẻ</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
