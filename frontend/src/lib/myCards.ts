// Phan nhom / mo ta han cho trang "Cong viec cua toi". HAM THUAN: nhan `now` de kiem thu duoc.

export type Bucket = 'overdue' | 'today' | 'week' | 'later' | 'none';

export const BUCKET_ORDER: Bucket[] = ['overdue', 'today', 'week', 'later', 'none'];

export const BUCKET_LABEL: Record<Bucket, string> = {
  overdue: 'Quá hạn',
  today: 'Hôm nay',
  week: 'Trong 7 ngày tới',
  later: 'Sau này',
  none: 'Chưa đặt hạn',
};

const DAY_MS = 86_400_000;

const startOfDay = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Nhom theo han: da qua gio han = Quá hạn; hết hôm nay = Hôm nay; trong 7 ngày kế tiếp = Trong 7 ngày tới. */
export function bucketOf(dueIso: string | null, now: Date): Bucket {
  if (!dueIso) return 'none';
  const due = new Date(dueIso);
  if (due.getTime() < now.getTime()) return 'overdue';
  const days = Math.round((startOfDay(due) - startOfDay(now)) / DAY_MS);
  if (days === 0) return 'today';
  if (days <= 7) return 'week';
  return 'later';
}

export type DueTone = 'danger' | 'warn' | 'muted';

/** Dong chu thu hai duoi ngay han: "Quá hạn 32 ngày", "Hôm nay", "Ngày mai", "Còn 3 ngày"; xa hon 7 ngay thi khong ghi. */
export function dueNote(dueIso: string | null, now: Date): { text: string; tone: DueTone } | null {
  if (!dueIso) return null;
  const due = new Date(dueIso);
  const days = Math.round((startOfDay(due) - startOfDay(now)) / DAY_MS);
  if (due.getTime() < now.getTime()) {
    return days === 0 ? { text: 'Quá giờ hôm nay', tone: 'danger' } : { text: `Quá hạn ${-days} ngày`, tone: 'danger' };
  }
  if (days === 0) return { text: 'Hôm nay', tone: 'warn' };
  if (days === 1) return { text: 'Ngày mai', tone: 'warn' };
  if (days <= 7) return { text: `Còn ${days} ngày`, tone: 'muted' };
  return null;
}

/** So khop khong phan biet hoa thuong va dau tieng Viet. Chuoi tim rong = khop het. */
export function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLocaleLowerCase('vi')
    .trim();
}

export function matchesTitle(title: string, query: string): boolean {
  const q = fold(query);
  return q === '' || fold(title).includes(q);
}
