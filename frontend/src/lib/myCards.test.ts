import { describe, expect, it } from 'vitest';
import { bucketOf, dueNote, fold, matchesTitle } from './myCards';

// Giữa trưa thứ Tư 14/10/2026 theo giờ máy: tránh lệch ngày khi đổi sang ISO
const NOW = new Date(2026, 9, 14, 12, 0, 0);
const at = (day: number, hour = 9, month = 9) => new Date(2026, month, day, hour, 0, 0).toISOString();

describe('bucketOf', () => {
  it('chia theo giờ hạn: quá hạn / hôm nay / 7 ngày tới / sau này / chưa đặt hạn', () => {
    expect(bucketOf(null, NOW)).toBe('none');
    expect(bucketOf(at(13), NOW)).toBe('overdue');
    expect(bucketOf(at(14, 9), NOW)).toBe('overdue'); // hôm nay nhưng đã qua giờ
    expect(bucketOf(at(14, 18), NOW)).toBe('today');
    expect(bucketOf(at(15), NOW)).toBe('week');
    expect(bucketOf(at(21), NOW)).toBe('week');
    expect(bucketOf(at(22), NOW)).toBe('later');
    expect(bucketOf(at(5, 9, 10), NOW)).toBe('later');
  });
});

describe('dueNote', () => {
  it('quá hạn tính theo ngày lịch, có mức độ', () => {
    expect(dueNote(at(10), NOW)).toEqual({ text: 'Quá hạn 4 ngày', tone: 'danger' });
    expect(dueNote(at(13), NOW)).toEqual({ text: 'Quá hạn 1 ngày', tone: 'danger' });
    expect(dueNote(at(14, 9), NOW)).toEqual({ text: 'Quá giờ hôm nay', tone: 'danger' });
  });
  it('sắp tới: hôm nay, ngày mai, còn N ngày; xa hơn 7 ngày thì không ghi', () => {
    expect(dueNote(at(14, 18), NOW)).toEqual({ text: 'Hôm nay', tone: 'warn' });
    expect(dueNote(at(15), NOW)).toEqual({ text: 'Ngày mai', tone: 'warn' });
    expect(dueNote(at(17), NOW)).toEqual({ text: 'Còn 3 ngày', tone: 'muted' });
    expect(dueNote(at(21), NOW)).toEqual({ text: 'Còn 7 ngày', tone: 'muted' });
    expect(dueNote(at(22), NOW)).toBeNull();
    expect(dueNote(null, NOW)).toBeNull();
  });
});

describe('lọc theo tên', () => {
  it('không phân biệt hoa thường và dấu tiếng Việt', () => {
    expect(fold('  Đăng Nhập ')).toBe('dang nhap');
    expect(matchesTitle('Mời và chốt 3 diễn giả chính', 'chot')).toBe(true);
    expect(matchesTitle('Mời và chốt 3 diễn giả chính', 'DIEN GIA')).toBe(true);
    expect(matchesTitle('Mời và chốt 3 diễn giả chính', 'tài trợ')).toBe(false);
    expect(matchesTitle('bất kỳ', '   ')).toBe(true);
  });
});
