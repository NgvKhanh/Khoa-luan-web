// Du lieu trang Tong quan: GET /api/cards/mine tra completedAt (dem "xong tuan nay", ti le dung han).
import { describe, expect, it } from 'vitest';
import { agent, makeBoard, makeCard, makeDirectUser, makeList } from './helpers';

describe('Trang Tổng quan', () => {
  it('GET /api/cards/mine trả completedAt: null khi chưa xong, có giá trị sau khi đánh dấu xong', async () => {
    const owner = await makeDirectUser('Chủ');
    const board = await makeBoard(owner);
    const list = await makeList(owner, board.id);
    const card = await makeCard(owner, list.id, 'Viết báo cáo');
    await agent().post(`/api/cards/${card.id}/members`).set('Cookie', owner.cookie).send({ userId: owner.id }).expect(201);

    const before = await agent().get('/api/cards/mine').set('Cookie', owner.cookie).expect(200);
    expect(before.body.data.cards).toEqual([expect.objectContaining({ id: card.id, isDone: false, completedAt: null })]);

    const t0 = Date.now();
    await agent().patch(`/api/cards/${card.id}`).set('Cookie', owner.cookie).send({ isDone: true }).expect(200);
    const after = await agent().get('/api/cards/mine').set('Cookie', owner.cookie).expect(200);
    const row = after.body.data.cards[0] as { isDone: boolean; completedAt: string | null };
    expect(row.isDone).toBe(true);
    expect(new Date(row.completedAt ?? 0).getTime()).toBeGreaterThanOrEqual(t0 - 1000);
  });
});
