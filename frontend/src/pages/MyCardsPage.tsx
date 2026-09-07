import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyCards, type MyCard } from '../lib/api/card';
import { getErrorMessage } from '../lib/errorMessage';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Phan loai theo han: Quá hạn / Hôm nay / Tuần này / Sau này / Không có hạn
type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'none';
const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: 'Quá hạn',
  today: 'Hôm nay',
  week: 'Trong tuần này',
  later: 'Sau này',
  none: 'Không có ngày hết hạn',
};
const BUCKET_ORDER: Bucket[] = ['overdue', 'today', 'week', 'later', 'none'];

function bucketOf(card: MyCard): Bucket {
  if (!card.dueDate) return 'none';
  const due = new Date(card.dueDate).getTime();
  const now = Date.now();
  const endToday = new Date();
  endToday.setHours(23, 59, 59, 999);
  const endWeek = new Date(endToday);
  endWeek.setDate(endWeek.getDate() + 7);
  if (due < now) return 'overdue';
  if (due <= endToday.getTime()) return 'today';
  if (due <= endWeek.getTime()) return 'week';
  return 'later';
}

export default function MyCardsPage() {
  const [cards, setCards] = useState<MyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hideDone, setHideDone] = useState(true);

  useEffect(() => {
    fetchMyCards()
      .then(setCards)
      .catch((err) => setError(getErrorMessage(err, 'Không tải được thẻ.')))
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => {
    const visible = hideDone ? cards.filter((c) => !c.isDone) : cards;
    const map = new Map<Bucket, MyCard[]>();
    for (const c of visible) {
      const b = bucketOf(c);
      if (!map.has(b)) map.set(b, []);
      map.get(b)!.push(c);
    }
    return BUCKET_ORDER.filter((b) => map.has(b)).map((b) => ({
      bucket: b,
      items: map.get(b)!,
    }));
  }, [cards, hideDone]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="flex-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Thẻ của tôi
        </h1>
        <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
          <input
            type="checkbox"
            checked={hideDone}
            onChange={(e) => setHideDone(e.target.checked)}
          />
          Ẩn thẻ đã hoàn thành
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Đang tải...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Bạn chưa được gán vào thẻ nào.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map(({ bucket, items }) => (
            <div key={bucket}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {BUCKET_LABEL[bucket]} ({items.length})
              </p>
              <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
                {items.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/boards/${c.list.boardId}`}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                    >
                      <span
                        className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${
                          c.isDone
                            ? 'border-emerald-600 bg-emerald-600 text-white'
                            : 'border-slate-300'
                        }`}
                      >
                        {c.isDone && (
                          <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="4">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        {c.labels.length > 0 && (
                          <span className="mb-1 flex flex-wrap gap-1">
                            {c.labels.map((l) => (
                              <span
                                key={l.labelId}
                                className="h-1.5 w-8 rounded-full"
                                style={{ backgroundColor: l.label.color }}
                              />
                            ))}
                          </span>
                        )}
                        <span
                          className={`block text-sm ${
                            c.isDone
                              ? 'text-slate-400 line-through'
                              : 'text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          {c.title}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-400">
                          {c.list.board.name} · {c.list.name}
                          {c.dueDate && ` · hạn ${fmtDate(c.dueDate)}`}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
