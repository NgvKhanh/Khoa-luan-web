import { useMemo, useState } from 'react';
import Avatar from '../Avatar';
import { fmt } from './cardModal/helpers';
import type { BoardList } from '../../types/list';

type SortKey = 'title' | 'list' | 'dueDate' | 'status';

interface Props {
  lists: BoardList[];
  onOpenCard: (cardId: string) => void;
}

export default function BoardTableView({ lists, onOpenCard }: Props) {
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('list');
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    const all = lists.flatMap((l) =>
      l.cards
        .filter((c) => !term || c.title.toLowerCase().includes(term))
        .map((c) => ({ card: c, listName: l.name, listId: l.id }))
    );
    const dir = sortDir;
    return all.sort((a, b) => {
      switch (sortKey) {
        case 'title':
          return dir * a.card.title.localeCompare(b.card.title, 'vi');
        case 'list':
          return dir * a.listName.localeCompare(b.listName, 'vi');
        case 'status':
          return dir * (Number(a.card.isDone) - Number(b.card.isDone));
        case 'dueDate': {
          const av = a.card.dueDate ? new Date(a.card.dueDate).getTime() : Infinity;
          const bv = b.card.dueDate ? new Date(b.card.dueDate).getTime() : Infinity;
          return dir * (av - bv);
        }
        default:
          return 0;
      }
    });
  }, [lists, query, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  function Th({ label, sortableKey }: { label: string; sortableKey?: SortKey }) {
    const active = sortableKey && sortKey === sortableKey;
    return (
      <th
        className={`whitespace-nowrap px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 ${
          sortableKey ? 'cursor-pointer select-none hover:text-slate-900 dark:hover:text-slate-100' : ''
        }`}
        onClick={sortableKey ? () => toggleSort(sortableKey) : undefined}
      >
        {label}
        {active && <span className="ml-1">{sortDir === 1 ? '▲' : '▼'}</span>}
      </th>
    );
  }

  const now = Date.now();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Tìm thẻ theo tên..."
        className="mb-2 w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm focus:border-[#0c66e4] focus:outline-none dark:border-slate-600 dark:bg-slate-800"
      />
      <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-white/90 shadow-sm dark:bg-slate-800/90">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
            <tr>
              <Th label="" />
              <Th label="Tên thẻ" sortableKey="title" />
              <Th label="Danh sách" sortableKey="list" />
              <Th label="Nhãn" />
              <Th label="Thành viên" />
              <Th label="Hạn" sortableKey="dueDate" />
              <Th label="Trạng thái" sortableKey="status" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ card, listName }) => {
              const overdue =
                card.dueDate && !card.isDone && new Date(card.dueDate).getTime() < now;
              return (
                <tr
                  key={card.id}
                  onClick={() => onOpenCard(card.id)}
                  className="cursor-pointer border-t border-slate-100 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-700/50"
                >
                  <td className="px-3 py-2">
                    <span
                      className={`block h-4 w-4 rounded-full border-2 ${
                        card.isDone
                          ? 'border-emerald-600 bg-emerald-600'
                          : 'border-slate-300 dark:border-slate-500'
                      }`}
                    />
                  </td>
                  <td
                    className={`px-3 py-2 text-sm ${
                      card.isDone
                        ? 'text-slate-400 line-through'
                        : 'text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {card.title}
                  </td>
                  <td className="px-3 py-2 text-sm text-slate-600 dark:text-slate-300">
                    {listName}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {(card.labels ?? []).map((l) => (
                        <span
                          key={l.labelId}
                          className="h-2 w-6 rounded-full"
                          style={{ backgroundColor: l.label.color }}
                          title={l.label.name}
                        />
                      ))}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex -space-x-1">
                      {(card.members ?? []).map((m) => (
                        <Avatar
                          key={m.userId}
                          id={m.userId}
                          name={m.user.name}
                          avatarUrl={m.user.avatarUrl}
                          className="h-6 w-6 text-[10px]"
                        />
                      ))}
                    </div>
                  </td>
                  <td
                    className={`px-3 py-2 text-sm ${
                      overdue ? 'font-medium text-red-600' : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {card.dueDate ? fmt(card.dueDate) : '—'}
                  </td>
                  <td className="px-3 py-2 text-sm">
                    {card.isDone ? (
                      <span className="text-emerald-600">Hoàn thành</span>
                    ) : overdue ? (
                      <span className="text-red-600">Quá hạn</span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400">Đang làm</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-400">
                  Không có thẻ nào.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
