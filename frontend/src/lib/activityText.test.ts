import { describe, expect, it } from 'vitest';
import { activityPhrase } from './activityText';

describe('activityPhrase', () => {
  it('ai.board.create hien so the thay vi ma tho', () => {
    expect(activityPhrase({ type: 'ai.board.create', data: { cardCount: 5, runId: 'r1' } })).toBe(
      'đã tạo bảng này bằng AI (5 thẻ)'
    );
  });

  it('ai.board.create thieu cardCount -> dau "?" chu khong phai "undefined"', () => {
    expect(activityPhrase({ type: 'ai.board.create', data: {} })).toBe('đã tạo bảng này bằng AI (? thẻ)');
  });

  it('loai chua biet van tra ve ma tho (hanh vi co san khong bi doi)', () => {
    expect(activityPhrase({ type: 'loai.la', data: {} })).toBe('loai.la');
    expect(activityPhrase({ type: 'card.rename', data: {} })).toBe('đã đổi tên thẻ');
  });
});
