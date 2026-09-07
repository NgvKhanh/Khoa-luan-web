import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCalendarCards, type CalendarCard } from '../lib/api/card';
import { getErrorMessage } from '../lib/errorMessage';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const MONTHS = [
  'Tháng 1',
  'Tháng 2',
  'Tháng 3',
  'Tháng 4',
  'Tháng 5',
  'Tháng 6',
  'Tháng 7',
  'Tháng 8',
  'Tháng 9',
  'Tháng 10',
  'Tháng 11',
  'Tháng 12',
];

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate()
  ).padStart(2, '0')}`;
}

// Thu 2 dau tuan: 0=T2 ... 6=CN
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

export default function CalendarPage() {
  const navigate = useNavigate();
  const [anchor, setAnchor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [cards, setCards] = useState<CalendarCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 42 o luoi, bat dau tu thu 2 cua tuan chua ngay 1
  const gridStart = useMemo(() => {
    const first = new Date(anchor);
    const s = new Date(first);
    s.setDate(first.getDate() - mondayIndex(first));
    s.setHours(0, 0, 0, 0);
    return s;
  }, [anchor]);

  const days = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => {
        const d = new Date(gridStart);
        d.setDate(gridStart.getDate() + i);
        return d;
      }),
    [gridStart]
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    const from = new Date(gridStart);
    const to = new Date(gridStart);
    to.setDate(to.getDate() + 42);
    fetchCalendarCards(from.toISOString(), to.toISOString())
      .then(setCards)
      .catch((err) => setError(getErrorMessage(err, 'Không tải được lịch.')))
      .finally(() => setLoading(false));
  }, [gridStart]);

  const byDay = useMemo(() => {
    const m = new Map<string, CalendarCard[]>();
    for (const c of cards) {
      const key = ymd(new Date(c.dueDate));
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(c);
    }
    return m;
  }, [cards]);

  const todayKey = ymd(new Date());
  const shiftMonth = (delta: number) =>
    setAnchor((a) => new Date(a.getFullYear(), a.getMonth() + delta, 1));

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="flex-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
          Lịch — {MONTHS[anchor.getMonth()]} {anchor.getFullYear()}
        </h1>
        <button
          type="button"
          onClick={() => shiftMonth(-1)}
          className="rounded-lg border border-slate-300 px-2.5 py-1 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={() => {
            const n = new Date();
            setAnchor(new Date(n.getFullYear(), n.getMonth(), 1));
          }}
          className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          Hôm nay
        </button>
        <button
          type="button"
          onClick={() => shiftMonth(1)}
          className="rounded-lg border border-slate-300 px-2.5 py-1 text-sm hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
        >
          ›
        </button>
      </div>

      {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
      {loading && (
        <p className="mb-2 text-sm text-slate-400">Đang tải...</p>
      )}

      <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-slate-200 bg-white text-sm dark:border-slate-700 dark:bg-slate-800">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="border-b border-slate-200 bg-slate-50 py-1.5 text-center text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
          >
            {w}
          </div>
        ))}
        {days.map((d, i) => {
          const key = ymd(d);
          const inMonth = d.getMonth() === anchor.getMonth();
          const dayCards = byDay.get(key) ?? [];
          return (
            <div
              key={i}
              className={`min-h-[92px] border-b border-r border-slate-100 p-1 dark:border-slate-700/60 ${
                inMonth ? '' : 'bg-slate-50/60 dark:bg-slate-900/40'
              }`}
            >
              <div
                className={`mb-1 text-right text-xs ${
                  key === todayKey
                    ? 'font-bold text-[#0c66e4]'
                    : inMonth
                      ? 'text-slate-500'
                      : 'text-slate-300 dark:text-slate-600'
                }`}
              >
                {d.getDate()}
              </div>
              <div className="flex flex-col gap-1">
                {dayCards.slice(0, 3).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => navigate(`/boards/${c.list.boardId}`)}
                    title={`${c.title} — ${c.list.board.name}`}
                    className={`flex items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] ${
                      c.isDone
                        ? 'text-slate-400 line-through'
                        : 'text-slate-700 dark:text-slate-200'
                    } hover:bg-slate-100 dark:hover:bg-slate-700`}
                  >
                    <span
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: c.list.board.color }}
                    />
                    <span className="truncate">{c.title}</span>
                  </button>
                ))}
                {dayCards.length > 3 && (
                  <span className="px-1 text-[10px] text-slate-400">
                    +{dayCards.length - 3} thẻ nữa
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
