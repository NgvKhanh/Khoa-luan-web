import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Avatar from '../components/Avatar';
import { Skeleton, SkeletonRegion, SkeletonRows } from '../components/Skeleton';
import { useAuth } from '../context/AuthContext';
import { useBoards } from '../context/BoardsContext';
import { activityPhrase } from '../lib/activityText';
import { assetUrl } from '../lib/assets';
import { fetchHomeActivity, type HomeActivity } from '../lib/api/board';
import { fetchMyCards, type MyCard } from '../lib/api/card';
import { getErrorMessage } from '../lib/errorMessage';
import { getRecentBoards } from '../lib/recentBoards';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 11) return 'Chào buổi sáng';
  if (h < 14) return 'Chào buổi trưa';
  if (h < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

function firstName(name?: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] ?? name;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'vừa xong';
  if (s < 3600) return `${Math.floor(s / 60)} phút trước`;
  if (s < 86400) return `${Math.floor(s / 3600)} giờ trước`;
  if (s < 604800) return `${Math.floor(s / 86400)} ngày trước`;
  return new Date(iso).toLocaleDateString('vi-VN');
}

function endOfToday(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}
function endOfWeek(): number {
  return endOfToday() + 7 * 86400 * 1000;
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-3 flex items-center">
        <h2 className="flex-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function BoardTile({
  id,
  name,
  color,
  backgroundImage,
}: {
  id: string;
  name: string;
  color: string;
  backgroundImage: string | null;
}) {
  return (
    <Link
      to={`/boards/${id}`}
      className="group relative flex h-16 items-end overflow-hidden rounded-lg p-2 text-sm font-semibold text-white shadow-sm ring-1 ring-black/5"
      style={
        backgroundImage
          ? {
              backgroundImage: `url(${assetUrl(backgroundImage)})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : { backgroundColor: color }
      }
    >
      <span className="absolute inset-0 bg-black/20 transition group-hover:bg-black/30" />
      <span className="relative line-clamp-2 leading-tight drop-shadow">
        {name}
      </span>
    </Link>
  );
}

const DUE_GROUPS: { key: string; label: string; cls: string }[] = [
  { key: 'overdue', label: 'Quá hạn', cls: 'text-red-600' },
  { key: 'today', label: 'Hôm nay', cls: 'text-amber-600' },
  { key: 'week', label: 'Trong tuần', cls: 'text-slate-600 dark:text-slate-300' },
];

function bucketOf(c: MyCard): string | null {
  if (c.isDone || !c.dueDate) return null;
  const due = new Date(c.dueDate).getTime();
  if (due < Date.now()) return 'overdue';
  if (due <= endOfToday()) return 'today';
  if (due <= endOfWeek()) return 'week';
  return null;
}

export default function HomeDashboard() {
  const { user } = useAuth();
  const { boards } = useBoards();
  const navigate = useNavigate();

  const [myCards, setMyCards] = useState<MyCard[]>([]);
  const [activity, setActivity] = useState<HomeActivity[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchMyCards(), fetchHomeActivity()])
      .then(([cards, acts]) => {
        setMyCards(cards);
        setActivity(acts);
      })
      .catch((err) => setError(getErrorMessage(err, 'Không tải được trang chủ.')))
      .finally(() => setLoading(false));
  }, []);

  const assigned = myCards.filter((c) => !c.isDone);
  const overdue = assigned.filter(
    (c) => c.dueDate && new Date(c.dueDate).getTime() < Date.now()
  ).length;
  const dueWeek = assigned.filter((c) => {
    if (!c.dueDate) return false;
    const d = new Date(c.dueDate).getTime();
    return d >= Date.now() && d <= endOfWeek();
  }).length;

  const attention = useMemo(() => {
    const map: Record<string, MyCard[]> = {};
    for (const c of myCards) {
      const b = bucketOf(c);
      if (b) (map[b] ??= []).push(c);
    }
    return map;
  }, [myCards]);
  const hasAttention = DUE_GROUPS.some((g) => (attention[g.key]?.length ?? 0) > 0);

  const recent = useMemo(() => {
    const ids = getRecentBoards();
    return ids
      .map((id) => boards.find((b) => b.id === id))
      .filter((b): b is (typeof boards)[number] => Boolean(b))
      .slice(0, 6);
  }, [boards]);
  const starred = boards.filter((b) => b.isStarred).slice(0, 6);

  const stats = [
    { label: 'Bảng', value: boards.length, to: '/boards' },
    { label: 'Thẻ được giao', value: assigned.length, to: '/my-cards', fromCards: true },
    { label: 'Quá hạn', value: overdue, to: '/my-cards', danger: overdue > 0, fromCards: true },
    { label: 'Đến hạn trong tuần', value: dueWeek, to: '/calendar', fromCards: true },
  ];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
          {greeting()}
          {user?.name ? `, ${firstName(user.name)}` : ''} 👋
        </h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          {new Date().toLocaleDateString('vi-VN', {
            weekday: 'long',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
          })}
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* 1. So lieu nhanh */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => navigate(s.to)}
            className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:shadow dark:border-slate-700 dark:bg-slate-800"
          >
            <p
              className={`text-2xl font-bold ${
                s.danger
                  ? 'text-red-600'
                  : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {s.fromCards && loading ? (
                <Skeleton className="h-8 w-10" />
              ) : s.fromCards && error ? (
                '–'
              ) : (
                s.value
              )}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {s.label}
            </p>
          </button>
        ))}
      </div>

      {/* 2. Can chu y */}
      <Section
        title="Cần chú ý"
        action={
          <Link
            to="/my-cards"
            className="text-xs font-medium text-primary-ink hover:underline"
          >
            Xem tất cả
          </Link>
        }
      >
        {loading ? (
          <SkeletonRegion label="Đang tải thẻ cần chú ý…">
            <SkeletonRows rows={3} />
          </SkeletonRegion>
        ) : !hasAttention ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Không có thẻ nào sắp đến hạn. 🎉
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {DUE_GROUPS.map((g) => {
              const items = attention[g.key] ?? [];
              if (items.length === 0) return null;
              return (
                <div key={g.key}>
                  <p
                    className={`mb-1.5 text-xs font-semibold uppercase tracking-wide ${g.cls}`}
                  >
                    {g.label} ({items.length})
                  </p>
                  <ul className="flex flex-col gap-1">
                    {items.slice(0, 5).map((c) => (
                      <li key={c.id}>
                        <Link
                          to={`/boards/${c.list.boardId}`}
                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                          <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 border-slate-300" />
                          <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-100">
                            {c.title}
                          </span>
                          <span className="shrink-0 text-xs text-slate-400">
                            {c.list.board.name}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {/* 3. Truy cap nhanh */}
      {(recent.length > 0 || starred.length > 0) && (
        <Section title="Truy cập nhanh">
          {recent.length > 0 && (
            <>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Xem gần đây
              </p>
              <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {recent.map((b) => (
                  <BoardTile
                    key={b.id}
                    id={b.id}
                    name={b.name}
                    color={b.color}
                    backgroundImage={b.backgroundImage}
                  />
                ))}
              </div>
            </>
          )}
          {starred.length > 0 && (
            <>
              <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-amber-400" fill="currentColor">
                  <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z" />
                </svg>
                Đánh dấu sao
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {starred.map((b) => (
                  <BoardTile
                    key={b.id}
                    id={b.id}
                    name={b.name}
                    color={b.color}
                    backgroundImage={b.backgroundImage}
                  />
                ))}
              </div>
            </>
          )}
        </Section>
      )}

      {/* 4. Hoat dong gan day */}
      <Section title="Hoạt động gần đây">
        {loading ? (
          <SkeletonRegion label="Đang tải hoạt động gần đây…">
            <SkeletonRows rows={5} />
          </SkeletonRegion>
        ) : activity.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Chưa có hoạt động nào.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {activity.map((a) => (
              <li key={a.id} className="flex gap-2">
                <Avatar
                  id={a.user.id}
                  name={a.user.name}
                  avatarUrl={a.user.avatarUrl}
                  className="h-6 w-6 text-[10px]"
                />
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold text-slate-700 dark:text-slate-100">
                    {a.user.name}
                  </span>{' '}
                  {activityPhrase(a)}
                  {a.card && (
                    <span className="text-slate-500"> — “{a.card.title}”</span>
                  )}
                  {a.board && (
                    <>
                      {' · '}
                      <Link
                        to={`/boards/${a.board.id}`}
                        className="text-primary-ink hover:underline"
                      >
                        {a.board.name}
                      </Link>
                    </>
                  )}
                  <br />
                  <span className="text-slate-400">{timeAgo(a.createdAt)}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}
