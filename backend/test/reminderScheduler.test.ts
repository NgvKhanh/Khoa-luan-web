import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/config/prisma';
import { runOnce } from '../src/modules/card/reminder.scheduler';
import {
  addMember,
  agent,
  makeBoard,
  makeCard,
  makeList,
  makeUser,
} from './helpers';

async function setDueDate(actor: Awaited<ReturnType<typeof makeUser>>, cardId: string, iso: string) {
  await agent()
    .patch(`/api/cards/${cardId}`)
    .set('Cookie', actor.cookie)
    .send({ dueDate: iso })
    .expect(200);
}

async function addReminder(
  actor: Awaited<ReturnType<typeof makeUser>>,
  cardId: string,
  offsetMinutes: number
) {
  const res = await agent()
    .post(`/api/cards/${cardId}/reminders`)
    .set('Cookie', actor.cookie)
    .send({ offsetMinutes });
  expect(res.status).toBe(201);
}

describe('Vong quet nhac han (reminder.scheduler)', () => {
  it('nhac han da toi luc -> duoc gui va sentAt duoc dat', async () => {
    const owner = await makeUser();
    const board = await makeBoard(owner);
    const list = await makeList(owner, board.id);
    const card = await makeCard(owner, list.id);
    // Han da qua 5 phut -> nhac "10 phut truoc" chac chan da toi luc
    await setDueDate(owner, card.id, new Date(Date.now() - 5 * 60_000).toISOString());
    await addReminder(owner, card.id, 10);

    await runOnce();

    const row = await prisma.cardReminder.findFirst({ where: { cardId: card.id } });
    expect(row?.sentAt).not.toBeNull();

    const noti = await prisma.notification.findFirst({
      where: { userId: owner.id, cardId: card.id, type: 'card.due.reminder' },
    });
    expect(noti).toBeTruthy();
  });

  it('nhac han con xa (ngoai horizon) khong bi dong ngay ca khi co nhac khac da toi han', async () => {
    const owner = await makeUser();
    const board = await makeBoard(owner);
    const list = await makeList(owner, board.id);

    const farCard = await makeCard(owner, list.id, 'The con xa');
    await setDueDate(
      owner,
      farCard.id,
      new Date(Date.now() + 3 * 24 * 60 * 60_000).toISOString() // 3 ngay nua
    );
    await addReminder(owner, farCard.id, 1440); // nhac truoc 1 ngay -> remindAt con 2 ngay nua

    const dueCard = await makeCard(owner, list.id, 'The da toi han');
    await setDueDate(owner, dueCard.id, new Date(Date.now() - 60_000).toISOString());
    await addReminder(owner, dueCard.id, 10);

    await runOnce();

    const farRow = await prisma.cardReminder.findFirst({ where: { cardId: farCard.id } });
    expect(farRow?.sentAt).toBeNull();

    const dueRow = await prisma.cardReminder.findFirst({ where: { cardId: dueCard.id } });
    expect(dueRow?.sentAt).not.toBeNull();
  });

  it('200 reminder chua toi han (dueDate con 12 gio, nhac truoc 10 phut) khong lam "chiem cho" (gioi han take) cua 1 reminder KHAC da toi han that su', async () => {
    const owner = await makeUser();
    const board = await makeBoard(owner);
    const list = await makeList(owner, board.id);

    // Dung dung kich ban reviewer neu: 200 the han con 12h, nhac truoc 10
    // phut -> con rat lau moi toi luc nhac (khac voi "ngoai horizon" o test
    // truoc, o day dueDate van con TRONG pham vi 24h nhung remindAt van xa).
    const noiseDue = new Date(Date.now() + 12 * 60 * 60_000);
    const noiseIds = Array.from({ length: 200 }, () => randomUUID());
    await prisma.card.createMany({
      data: noiseIds.map((id, i) => ({
        id,
        listId: list.id,
        title: `Noise ${i}`,
        position: i,
        dueDate: noiseDue,
      })),
    });
    await prisma.cardReminder.createMany({
      data: noiseIds.map((cardId) => ({
        cardId,
        userId: owner.id,
        offsetMinutes: 10,
      })),
    });

    const dueCard = await makeCard(owner, list.id, 'The da toi han that su');
    await setDueDate(owner, dueCard.id, new Date(Date.now() - 60_000).toISOString());
    await addReminder(owner, dueCard.id, 10);

    await runOnce();

    const dueRow = await prisma.cardReminder.findFirst({ where: { cardId: dueCard.id } });
    expect(dueRow?.sentAt).not.toBeNull();

    const untouchedNoise = await prisma.cardReminder.count({
      where: { cardId: { in: noiseIds }, sentAt: null },
    });
    expect(untouchedNoise).toBe(200);
  });

  it('the da hoan thanh (isDone) -> khong gui nhac', async () => {
    const owner = await makeUser();
    const board = await makeBoard(owner);
    const list = await makeList(owner, board.id);
    const card = await makeCard(owner, list.id);
    await setDueDate(owner, card.id, new Date(Date.now() - 60_000).toISOString());
    await addReminder(owner, card.id, 10);
    await agent()
      .patch(`/api/cards/${card.id}`)
      .set('Cookie', owner.cookie)
      .send({ isDone: true })
      .expect(200);

    await runOnce();

    const row = await prisma.cardReminder.findFirst({ where: { cardId: card.id } });
    expect(row?.sentAt).toBeNull();
  });

  it('danh sach da luu tru -> khong gui nhac', async () => {
    const owner = await makeUser();
    const board = await makeBoard(owner);
    const list = await makeList(owner, board.id);
    const card = await makeCard(owner, list.id);
    await setDueDate(owner, card.id, new Date(Date.now() - 60_000).toISOString());
    await addReminder(owner, card.id, 10);
    await agent()
      .post(`/api/lists/${list.id}/archive`)
      .set('Cookie', owner.cookie)
      .expect(200);

    await runOnce();

    const row = await prisma.cardReminder.findFirst({ where: { cardId: card.id } });
    expect(row?.sentAt).toBeNull();
  });

  it('nguoi dat nhac mat quyen xem bang truoc khi den han -> KHONG gui, xoa han reminder', async () => {
    const owner = await makeUser();
    const board = await makeBoard(owner);
    const list = await makeList(owner, board.id);
    const card = await makeCard(owner, list.id);

    const member = await makeUser();
    await addMember(owner, board.id, member.email);
    await setDueDate(owner, card.id, new Date(Date.now() - 60_000).toISOString());
    await addReminder(member, card.id, 10);

    // Thu hoi quyen truoc khi scheduler chay
    await agent()
      .delete(`/api/boards/${board.id}/members/${member.id}`)
      .set('Cookie', owner.cookie)
      .expect(200);

    await runOnce();

    const row = await prisma.cardReminder.findFirst({
      where: { cardId: card.id, userId: member.id },
    });
    expect(row).toBeNull();

    const noti = await prisma.notification.findFirst({
      where: { userId: member.id, cardId: card.id, type: 'card.due.reminder' },
    });
    expect(noti).toBeNull();
  });
});
