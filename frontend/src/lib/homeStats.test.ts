import { describe, expect, it } from 'vitest';
import { dayDiff, dayLabel, homeStats, startOfWeek } from './homeStats';

// Giữa trưa thứ Tư 14/10/2026 theo giờ máy
const NOW = new Date(2026, 9, 14, 12, 0, 0);
const at = (day: number, hour = 9, month = 9) => new Date(2026, month, day, hour, 0, 0).toISOString();

function card(over: { isDone?: boolean; dueDate?: string | null; completedAt?: string | null; boardId?: string }) {
  return {
    isDone: over.isDone ?? false,
    dueDate: over.dueDate ?? null,
    completedAt: over.completedAt ?? null,
    list: { boardId: over.boardId ?? 'b1' } as never,
  };
}

describe('startOfWeek / dayDiff / dayLabel', () => {
  it('tuần bắt đầu 0h thứ Hai; Chủ nhật vẫn thuộc tuần đang chạy', () => {
    expect(startOfWeek(NOW)).toEqual(new Date(2026, 9, 12));
    expect(startOfWeek(new Date(2026, 9, 18, 23, 0))).toEqual(new Date(2026, 9, 12)); // Chủ nhật
    expect(startOfWeek(new Date(2026, 9, 19, 0, 30))).toEqual(new Date(2026, 9, 19)); // thứ Hai kế tiếp
  });

  it('đếm theo ngày lịch, bỏ qua giờ', () => {
    expect(dayDiff(NOW, new Date(2026, 9, 14, 23, 59))).toBe(0);
    expect(dayDiff(NOW, new Date(2026, 9, 15, 0, 1))).toBe(1);
    expect(dayDiff(new Date(2026, 9, 10), NOW)).toBe(4);
  });

  it('ngày viết giữa câu: hôm nay / ngày mai / thứ + ngày', () => {
    expect(dayLabel(at(14, 18), NOW)).toBe('hôm nay');
    expect(dayLabel(at(15), NOW)).toBe('ngày mai');
    expect(dayLabel(at(17), NOW)).toBe('thứ Bảy 17/10');
    expect(dayLabel(at(18), NOW)).toBe('Chủ nhật 18/10');
  });
});

describe('homeStats', () => {
  it('đếm thẻ mở, số bảng, quá hạn (trễ nhất), đến hạn 7 ngày tới (gần nhất), xong tuần này / tuần trước', () => {
    const s = homeStats(
      [
        card({ dueDate: at(10) }), // trễ 4 ngày
        card({ dueDate: at(13), boardId: 'b2' }), // trễ 1 ngày
        card({ dueDate: at(14, 18) }), // hôm nay
        card({ dueDate: at(20) }), // 7 ngày tới
        card({ dueDate: at(30) }), // xa hơn: chỉ tính vào thẻ mở
        card({}), // chưa đặt hạn
        card({ isDone: true, completedAt: at(12, 8) }), // thứ Hai tuần này
        card({ isDone: true, completedAt: at(14, 11) }),
        card({ isDone: true, completedAt: at(11, 22) }), // Chủ nhật tuần trước
        card({ isDone: true, completedAt: at(4) }), // hai tuần trước: không tính
        card({ isDone: true, dueDate: at(10) }), // xong nhưng thiếu completedAt: bỏ qua
      ],
      NOW
    );
    expect(s).toEqual({
      open: 6,
      openBoards: 2,
      overdue: 2,
      maxLateDays: 4,
      upcoming: 2,
      nextDue: at(14, 18),
      doneThisWeek: 2,
      doneLastWeek: 1,
    });
  });

  it('quá giờ ngay trong hôm nay thì trễ 0 ngày; không có thẻ thì toàn số 0', () => {
    expect(homeStats([card({ dueDate: at(14, 9) })], NOW)).toMatchObject({ overdue: 1, maxLateDays: 0 });
    expect(homeStats([], NOW)).toEqual({
      open: 0,
      openBoards: 0,
      overdue: 0,
      maxLateDays: 0,
      upcoming: 0,
      nextDue: null,
      doneThisWeek: 0,
      doneLastWeek: 0,
    });
  });
});
