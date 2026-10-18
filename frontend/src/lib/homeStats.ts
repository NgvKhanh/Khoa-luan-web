// So lieu dau trang Tong quan, tinh tu danh sach the duoc giao (/cards/mine). HAM THUAN: nhan `now` de kiem thu duoc.
import type { MyCard } from './api/card';
import { bucketOf } from './myCards';

const DAY_MS = 86_400_000;

export const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/** So ngay lich tu `from` den `to` (bo qua gio): cung ngay = 0, hom sau = 1. */
export const dayDiff = (from: Date, to: Date): number =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS);

/** 0h thu Hai cua tuan chua `now` (tuan tinh tu thu Hai den Chu nhat). */
export function startOfWeek(now: Date): Date {
  const d = startOfDay(now);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

const WEEKDAY = ['Chủ nhật', 'thứ Hai', 'thứ Ba', 'thứ Tư', 'thứ Năm', 'thứ Sáu', 'thứ Bảy'];
const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export const weekdayName = (d: Date): string => WEEKDAY[d.getDay()];
export const weekdayShort = (d: Date): string => WEEKDAY_SHORT[d.getDay()];

/** Ngay viet giua cau: "hôm nay", "ngày mai", "thứ Tư 21/10". */
export function dayLabel(iso: string, now: Date): string {
  const d = new Date(iso);
  const diff = dayDiff(now, d);
  if (diff === 0) return 'hôm nay';
  if (diff === 1) return 'ngày mai';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${weekdayName(d)} ${dd}/${mm}`;
}

export interface HomeStats {
  /** The chua xong. */
  open: number;
  /** So bang co the chua xong. */
  openBoards: number;
  overdue: number;
  /** So ngay tre cua the tre lau nhat (0 = qua gio ngay hom nay). */
  maxLateDays: number;
  /** Han tu bay gio den het 7 ngay toi (cung pham vi voi khoi "Can chu y": hom nay + 7 ngay toi). */
  upcoming: number;
  /** Han gan nhat trong nhom tren. */
  nextDue: string | null;
  doneThisWeek: number;
  doneLastWeek: number;
}

export function homeStats(cards: Pick<MyCard, 'isDone' | 'dueDate' | 'completedAt' | 'list'>[], now: Date): HomeStats {
  const weekStart = startOfWeek(now).getTime();
  const lastWeekStart = weekStart - 7 * DAY_MS;
  const boards = new Set<string>();
  let open = 0;
  let overdue = 0;
  let oldestOverdue: number | null = null;
  let upcoming = 0;
  let nextDue: string | null = null;
  let doneThisWeek = 0;
  let doneLastWeek = 0;

  for (const c of cards) {
    if (c.isDone) {
      const t = c.completedAt ? new Date(c.completedAt).getTime() : NaN;
      if (t >= weekStart) doneThisWeek += 1;
      else if (t >= lastWeekStart) doneLastWeek += 1;
      continue;
    }
    open += 1;
    boards.add(c.list.boardId);
    const b = bucketOf(c.dueDate, now);
    if (b === 'overdue') {
      overdue += 1;
      const t = new Date(c.dueDate!).getTime();
      if (oldestOverdue === null || t < oldestOverdue) oldestOverdue = t;
    } else if (b === 'today' || b === 'week') {
      upcoming += 1;
      if (nextDue === null || new Date(c.dueDate!).getTime() < new Date(nextDue).getTime()) nextDue = c.dueDate;
    }
  }

  return {
    open,
    openBoards: boards.size,
    overdue,
    maxLateDays: oldestOverdue === null ? 0 : dayDiff(new Date(oldestOverdue), now),
    upcoming,
    nextDue,
    doneThisWeek,
    doneLastWeek,
  };
}
