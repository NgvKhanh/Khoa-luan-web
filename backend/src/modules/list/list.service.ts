import { prisma } from '../../config/prisma';
import { AppError } from '../../utils/AppError';
import { assertBoardAccess, assertBoardView } from '../board/board.service';
import type {
  CreateListInput,
  MoveAllCardsInput,
  SortListInput,
  UpdateListInput,
} from './list.schema';

// Lay 1 danh sach con hoat dong va kiem tra nguoi dung so huu bang chua no.
// Export de module card tai su dung.
export async function assertListAccess(userId: string, listId: string) {
  const list = await prisma.list.findFirst({
    where: { id: listId, deletedAt: null },
  });
  if (!list) {
    throw new AppError('Khong tim thay danh sach', 404);
  }
  await assertBoardAccess(userId, list.boardId);
  return list;
}

export async function listBoardLists(userId: string, boardId: string) {
  await assertBoardView(userId, boardId);
  return prisma.list.findMany({
    where: { boardId, deletedAt: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    include: {
      cards: {
        where: { deletedAt: null },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        include: {
          labels: { include: { label: true } },
          members: {
            include: {
              user: {
                select: { id: true, name: true, email: true, avatarUrl: true },
              },
            },
          },
          checklists: { select: { items: { select: { isDone: true } } } },
          comments: { where: { deletedAt: null }, select: { id: true } },
        },
      },
    },
  });
}

export async function createList(
  userId: string,
  boardId: string,
  input: CreateListInput
) {
  await assertBoardAccess(userId, boardId);

  const last = await prisma.list.findFirst({
    where: { boardId, deletedAt: null },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = last ? last.position + 1 : 0;

  return prisma.list.create({
    data: { boardId, name: input.name, position },
  });
}

export async function updateList(
  userId: string,
  listId: string,
  input: UpdateListInput
) {
  const list = await assertListAccess(userId, listId);

  // Keo sap xep lai: dua cot nay toi vi tri input.position roi danh so lai het
  if (input.position !== undefined) {
    const others = await prisma.list.findMany({
      where: { boardId: list.boardId, deletedAt: null, id: { not: listId } },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    const target = Math.min(Math.max(input.position, 0), others.length);
    const orderedIds = [
      ...others.slice(0, target).map((l) => l.id),
      listId,
      ...others.slice(target).map((l) => l.id),
    ];

    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.list.update({
          where: { id },
          data: {
            position: index,
            ...(id === listId && input.name !== undefined
              ? { name: input.name }
              : {}),
          },
        })
      )
    );

    return prisma.list.findFirst({ where: { id: listId } });
  }

  return prisma.list.update({
    where: { id: listId },
    data: { ...(input.name !== undefined ? { name: input.name } : {}) },
  });
}

export async function deleteList(userId: string, listId: string) {
  await assertListAccess(userId, listId);
  await prisma.list.update({
    where: { id: listId },
    data: { deletedAt: new Date() },
  });
}

// Sao chep danh sach (kem toan bo the) va chen ngay sau danh sach goc
export async function copyList(userId: string, listId: string) {
  const src = await assertListAccess(userId, listId);

  const cards = await prisma.card.findMany({
    where: { listId, deletedAt: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  });

  // Day cac cot phia sau ra 1 bac de chua ban sao
  await prisma.list.updateMany({
    where: {
      boardId: src.boardId,
      deletedAt: null,
      position: { gt: src.position },
    },
    data: { position: { increment: 1 } },
  });

  return prisma.list.create({
    data: {
      boardId: src.boardId,
      name: `${src.name} (bản sao)`.slice(0, 100),
      position: src.position + 1,
      cards: {
        create: cards.map((c, i) => ({
          title: c.title,
          description: c.description,
          isDone: c.isDone,
          position: i,
        })),
      },
    },
    include: {
      cards: {
        where: { deletedAt: null },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });
}

// Chuyen toan bo the cua danh sach nay sang mot danh sach khac cung bang
export async function moveAllCards(
  userId: string,
  listId: string,
  input: MoveAllCardsInput
) {
  const src = await assertListAccess(userId, listId);

  if (input.targetListId === listId) {
    throw new AppError('Danh sach dich trung voi danh sach nguon', 400);
  }
  const target = await prisma.list.findFirst({
    where: { id: input.targetListId, deletedAt: null },
  });
  if (!target || target.boardId !== src.boardId) {
    throw new AppError('Danh sach dich khong hop le', 400);
  }

  const targetCards = await prisma.card.findMany({
    where: { listId: target.id, deletedAt: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  const movingCards = await prisma.card.findMany({
    where: { listId, deletedAt: null },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });

  const orderedIds = [
    ...targetCards.map((c) => c.id),
    ...movingCards.map((c) => c.id),
  ];
  await prisma.$transaction(
    orderedIds.map((id, i) =>
      prisma.card.update({
        where: { id },
        data: { listId: target.id, position: i },
      })
    )
  );
}

// Sap xep lai the trong danh sach theo tieu chi
export async function sortListCards(
  userId: string,
  listId: string,
  input: SortListInput
) {
  await assertListAccess(userId, listId);

  const cards = await prisma.card.findMany({
    where: { listId, deletedAt: null },
  });

  const sorted = [...cards].sort((a, b) => {
    switch (input.by) {
      case 'created-desc':
        return b.createdAt.getTime() - a.createdAt.getTime();
      case 'created-asc':
        return a.createdAt.getTime() - b.createdAt.getTime();
      case 'title-asc':
        return a.title.localeCompare(b.title, 'vi');
      case 'done':
        // The chua xong len tren, xong xuong duoi
        return Number(a.isDone) - Number(b.isDone);
      default:
        return 0;
    }
  });

  await prisma.$transaction(
    sorted.map((c, i) =>
      prisma.card.update({ where: { id: c.id }, data: { position: i } })
    )
  );
}

// Xoa (mem) toan bo the trong danh sach
export async function deleteAllCards(userId: string, listId: string) {
  await assertListAccess(userId, listId);
  await prisma.card.updateMany({
    where: { listId, deletedAt: null },
    data: { deletedAt: new Date() },
  });
}
