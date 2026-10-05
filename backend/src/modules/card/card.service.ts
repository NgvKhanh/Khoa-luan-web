import { prisma } from '../../config/prisma';
import { Prisma } from '../../generated/prisma/client';
import { emitToBoard } from '../../realtime/socket';
import { AppError } from '../../utils/AppError';
import { logActivity } from '../activity/activity.service';
import { runAutomationsForCard } from '../automation/automation.service';
import {
  assertBoardAccess,
  isBoardParticipant,
} from '../board/board.service';
import { cardMemberIds, notify } from '../notification/notification.service';
import { assertListAccess, assertListView } from '../list/list.service';
import { memberWorkspaceIds } from '../workspace/workspace.service';
import { resetCardRemindersOnDueDateChange } from './cardReminder.service';
import { maskDeletedComments, VISIBLE_COMMENT_WHERE } from './commentThread';
import { isWatchingCard } from '../watch/watch.service';
import {
  firstListWithStatus,
  initialStatusData,
  logStatusChange,
  reopenStatus,
  statusWrite,
  type CardStatus,
} from './cardStatus';
import type {
  CreateCardInput,
  MoveCardInput,
  UpdateCardInput,
} from './card.schema';

const CARD_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatarUrl: true,
} as const;

// Dung rieng cho searchCards(): ket qua co the tra ve the tren bang PUBLIC
// ma nguoi goi khong phai thanh vien - khong duoc lo email cho khach xem nhu vay.
const SEARCH_USER_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
} as const;

// Sao chep 1 the (kem nhan, thanh vien, checklist + muc) sang cung/khac danh sach cung bang
export async function copyCard(
  userId: string,
  cardId: string,
  input: { title?: string; listId?: string }
) {
  const src = await assertCardAccess(userId, cardId);
  const boardId = src.list.boardId;
  const targetListId = input.listId ?? src.listId;

  const tl = await prisma.list.findFirst({
    where: { id: targetListId, deletedAt: null, archivedAt: null },
  });
  if (!tl || tl.boardId !== boardId) {
    throw new AppError('Danh sach dich khong hop le', 400);
  }

  const full = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      labels: true,
      members: true,
      checklists: { include: { items: true } },
    },
  });

  const last = await prisma.card.findFirst({
    where: { listId: targetListId, deletedAt: null, archivedAt: null },
    orderBy: { position: 'desc' },
    select: { position: true },
  });

  const created = await prisma.card.create({
    data: {
      listId: targetListId,
      title: (input.title?.trim() || `${src.title} (bản sao)`).slice(0, 500),
      description: src.description,
      startDate: src.startDate,
      dueDate: src.dueDate,
      coverColor: src.coverColor,
      coverImageUrl: src.coverImageUrl,
      position: last ? last.position + 1 : 0,
      // Ban sao la the moi: trang thai theo cot dich (cot tu do -> TODO)
      ...initialStatusData(tl.status),
      ...(full && full.labels.length > 0
        ? { labels: { create: full.labels.map((l) => ({ labelId: l.labelId })) } }
        : {}),
      ...(full && full.members.length > 0
        ? { members: { create: full.members.map((m) => ({ userId: m.userId })) } }
        : {}),
      ...(full && full.checklists.length > 0
        ? {
            checklists: {
              create: full.checklists.map((cl) => ({
                title: cl.title,
                position: cl.position,
                items: {
                  create: cl.items.map((it) => ({
                    content: it.content,
                    isDone: it.isDone,
                    position: it.position,
                    assigneeId: it.assigneeId,
                    dueDate: it.dueDate,
                  })),
                },
              })),
            },
          }
        : {}),
    },
  });

  await logActivity({
    boardId,
    cardId: created.id,
    userId,
    type: 'card.create',
    data: { listName: src.list.name },
  });

  return created;
}

// Lay 1 the con hoat dong + kiem tra quyen. Tra ve card kem boardId (de ghi log).
export async function assertCardAccess(userId: string, cardId: string) {
  const card = await prisma.card.findFirst({
    where: { id: cardId, deletedAt: null, archivedAt: null },
    include: { list: { select: { boardId: true, name: true, status: true } } },
  });
  if (!card) {
    throw new AppError('Khong tim thay the', 404);
  }
  await assertListAccess(userId, card.listId);
  return card;
}

// Nhu tren nhung chi doi hoi QUYEN XEM (VIEWER cung qua duoc) - dung cho cac
// thiet lap ca nhan khong lam thay doi noi dung the: watch, nhac han rieng.
export async function assertCardView(userId: string, cardId: string) {
  const card = await prisma.card.findFirst({
    where: { id: cardId, deletedAt: null, archivedAt: null },
    include: { list: { select: { boardId: true, name: true } } },
  });
  if (!card) {
    throw new AppError('Khong tim thay the', 404);
  }
  await assertListView(userId, card.listId);
  return card;
}

// Tat ca cac the ma nguoi dung duoc gan lam thanh vien, tren moi bang
export async function listMyCards(userId: string) {
  // Chi lay the o bang nguoi dung CON quyen truy cap: chu bang / thanh vien bang
  // con hieu luc / thanh vien khong gian (bang WORKSPACE). Nguoi da bi thu hoi
  // quyen se khong con thay the du van con ban ghi CardMember cu.
  const myWorkspaceIds = await memberWorkspaceIds(userId);
  return prisma.card.findMany({
    where: {
      deletedAt: null,
      archivedAt: null,
      members: { some: { userId } },
      list: {
        deletedAt: null,
        archivedAt: null,
        board: {
          deletedAt: null,
          archivedAt: null,
          OR: [
            { ownerId: userId },
            { members: { some: { userId, deletedAt: null } } },
            { visibility: 'WORKSPACE', workspaceId: { in: myWorkspaceIds } },
          ],
        },
      },
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      title: true,
      isDone: true,
      startDate: true,
      dueDate: true,
      coverColor: true,
      list: {
        select: {
          id: true,
          name: true,
          boardId: true,
          board: { select: { id: true, name: true } },
        },
      },
      labels: { include: { label: true } },
    },
  });
}

const CALENDAR_LIST_SELECT = {
  id: true,
  name: true,
  boardId: true,
  board: { select: { id: true, name: true, color: true } },
} as const;

// Cac the co KHOANG [startDate, dueDate] (hoac chi dueDate neu khong dat
// startDate) GIAO voi khoang [from, to] dang xem - tren cac bang minh la
// thanh vien. The chi co dueDate coi nhu 1 diem (startDate = dueDate).
export async function listCalendarCards(userId: string, from: Date, to: Date) {
  return prisma.card.findMany({
    where: {
      deletedAt: null,
      archivedAt: null,
      OR: [
        { startDate: null, dueDate: { gte: from, lte: to } },
        { startDate: { lte: to }, dueDate: { gte: from } },
      ],
      list: {
        deletedAt: null,
        archivedAt: null,
        board: {
          deletedAt: null,
          members: { some: { userId, deletedAt: null } },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
    select: {
      id: true,
      title: true,
      isDone: true,
      startDate: true,
      dueDate: true,
      list: { select: CALENDAR_LIST_SELECT },
    },
  });
}

// Cac muc checklist co han trong khoang [from, to], tren cac bang minh la
// thanh vien - de hien thi cung luc voi the tren lich.
export async function listCalendarChecklistItems(
  userId: string,
  from: Date,
  to: Date
) {
  return prisma.checklistItem.findMany({
    where: {
      dueDate: { gte: from, lte: to },
      checklist: {
        card: {
          deletedAt: null,
          archivedAt: null,
          list: {
            deletedAt: null,
            archivedAt: null,
            board: {
              deletedAt: null,
              members: { some: { userId, deletedAt: null } },
            },
          },
        },
      },
    },
    orderBy: { dueDate: 'asc' },
    select: {
      id: true,
      content: true,
      isDone: true,
      dueDate: true,
      checklist: {
        select: {
          card: {
            select: {
              id: true,
              title: true,
              list: { select: CALENDAR_LIST_SELECT },
            },
          },
        },
      },
    },
  });
}

// Tim the theo tu khoa (tieu de + mo ta), tren moi bang nguoi dung co quyen truy cap
export async function searchCards(userId: string, query: string) {
  const term = query.trim();
  if (!term) return [];

  const myWorkspaceIds = await memberWorkspaceIds(userId);
  return prisma.card.findMany({
    where: {
      deletedAt: null,
      archivedAt: null,
      OR: [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ],
      list: {
        deletedAt: null,
        archivedAt: null,
        board: {
          deletedAt: null,
          archivedAt: null,
          OR: [
            { ownerId: userId },
            { members: { some: { userId, deletedAt: null } } },
            { visibility: 'WORKSPACE', workspaceId: { in: myWorkspaceIds } },
            { visibility: 'PUBLIC' },
          ],
        },
      },
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: 30,
    select: {
      id: true,
      title: true,
      isDone: true,
      dueDate: true,
      coverColor: true,
      list: {
        select: {
          id: true,
          name: true,
          boardId: true,
          board: { select: { id: true, name: true, color: true } },
        },
      },
      labels: { include: { label: true } },
      members: { include: { user: { select: SEARCH_USER_SELECT } } },
    },
  });
}

export async function getCardDetail(userId: string, cardId: string) {
  // assertCardView kiem tra CA danh sach cha con hoat dong (khong bi xoa/luu tru),
  // khac voi kiem assertBoardView truc tiep o day truoc day (bo sot list da xoa).
  await assertCardView(userId, cardId);

  const card = await prisma.card.findFirst({
    where: { id: cardId, deletedAt: null, archivedAt: null },
    include: {
      list: { select: { id: true, name: true, boardId: true, status: true } },
      members: { include: { user: { select: CARD_USER_SELECT } } },
      labels: { include: { label: true } },
      checklists: {
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        include: {
          items: {
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
            include: {
              assignee: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
      },
      comments: {
        where: VISIBLE_COMMENT_WHERE,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: CARD_USER_SELECT } },
      },
      attachments: {
        orderBy: { createdAt: 'desc' },
        include: {
          uploader: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      activities: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      },
      fieldValues: true,
    },
  });
  if (!card) throw new AppError('Khong tim thay the', 404);
  return {
    ...card,
    comments: maskDeletedComments(card.comments),
    isWatching: await isWatchingCard(userId, cardId),
  };
}

export async function createCard(
  userId: string,
  listId: string,
  input: CreateCardInput
) {
  const list = await assertListAccess(userId, listId);

  const last = await prisma.card.findFirst({
    where: { listId, deletedAt: null, archivedAt: null },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const position = last ? last.position + 1 : 0;

  const card = await prisma.card.create({
    data: { listId, title: input.title, position, ...initialStatusData(list.status) },
  });

  await logActivity({
    boardId: list.boardId,
    cardId: card.id,
    userId,
    type: 'card.create',
    data: { listName: list.name },
  });

  await runAutomationsForCard('CARD_CREATED', card.id, card.title, list.boardId, listId);

  // Tu dong hoa (vd SET_DONE) co the vua doi du lieu the - doc lai truoc khi
  // tra ve, tranh response cu (con isDone/... truoc khi tu dong hoa chay).
  return (await prisma.card.findUnique({ where: { id: card.id } })) ?? card;
}

export async function updateCard(
  userId: string,
  cardId: string,
  input: UpdateCardInput
) {
  const card = await assertCardAccess(userId, cardId);
  const boardId = card.list.boardId;

  // Quy yeu cau doi trang thai (status, hoac isDone = loi tat cua DONE) ve 1 lan ghi:
  //  - status / isDone=true -> chuyen sang `to` neu the chua o `to`;
  //  - isDone=false -> "mo lai": CHI khi the dang DONE.
  const statusReq: { to: CardStatus; onlyIfDone: boolean } | null =
    input.status !== undefined
      ? { to: input.status, onlyIfDone: false }
      : input.isDone === true
        ? { to: 'DONE', onlyIfDone: false }
        : input.isDone === false
          ? { to: reopenStatus(card.list.status), onlyIfDone: true }
          : null;
  const wantsChange =
    statusReq !== null &&
    (statusReq.onlyIfDone ? card.status === 'DONE' : card.status !== statusReq.to);

  // Lien ket 2 chieu: the dang o cot CO trang thai (khac trang thai moi) va bang
  // co cot mang trang thai moi -> chuyen the sang dau cot do (qua moveCard, nen
  // cung ghi nhat ky "chuyen the" va chay tu dong hoa nhu keo tha). The o cot tu
  // do, hoac bang khong co cot phu hop -> chi doi trang thai, the dung yen.
  const moveTo =
    statusReq !== null &&
    wantsChange &&
    card.list.status !== null &&
    card.list.status !== statusReq.to
      ? await firstListWithStatus(boardId, statusReq.to)
      : null;

  const { row: updated, change } = await prisma.$transaction(async (tx) => {
    let change: { from: CardStatus; to: CardStatus } | null = null;
    if (statusReq && !moveTo) {
      // CODE_REVIEW.md #13: khoa dong the (SELECT ... FOR UPDATE) roi doc trang thai
      // MOI NHAT truoc khi quyet dinh - snapshot `card` o tren doc TRUOC giao dich
      // nay, 1 request khac co the vua doi trang thai xen vao giua.
      await tx.$queryRaw`SELECT id FROM "Card" WHERE id = ${cardId} FOR UPDATE`;
      const current = (
        await tx.card.findUniqueOrThrow({ where: { id: cardId }, select: { status: true } })
      ).status;
      const to = statusReq.onlyIfDone && current !== 'DONE' ? null : statusReq.to;
      if (to && to !== current) {
        await statusWrite(tx, { id: cardId }, to);
        change = { from: current, to };
      }
    }
    const row = await tx.card.update({
      where: { id: cardId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: input.description }
          : {}),
        ...(input.startDate !== undefined
          ? { startDate: input.startDate ? new Date(input.startDate) : null }
          : {}),
        ...(input.dueDate !== undefined
          ? { dueDate: input.dueDate ? new Date(input.dueDate) : null }
          : {}),
        ...(input.coverColor !== undefined
          ? { coverColor: input.coverColor }
          : {}),
        ...(input.coverImageUrl !== undefined
          ? { coverImageUrl: input.coverImageUrl || null }
          : {}),
      },
    });
    return { row, change };
  });

  const recipients = () => cardMemberIds(cardId);

  let finalCard = updated;
  if (statusReq && moveTo) {
    // moveCard tu doi trang thai theo cot dich + ghi nhat ky; day la thao tac
    // doi tay nen gui them thong bao "da hoan thanh" nhu tick truc tiep.
    finalCard =
      (await moveCard(
        userId,
        cardId,
        { listId: moveTo.id, position: 0 },
        { notifyDone: true }
      )) ?? updated;
  } else if (change) {
    await logStatusChange({
      boardId,
      cardId,
      cardTitle: input.title ?? card.title,
      userId,
      from: change.from,
      to: change.to,
      notifyDone: true,
    });
  }

  if (input.title !== undefined && input.title !== card.title) {
    await logActivity({
      boardId,
      cardId,
      userId,
      type: 'card.rename',
      data: { from: card.title, to: input.title },
    });
    await notify({
      recipients: await recipients(),
      actorId: userId,
      type: 'card.renamed',
      boardId,
      cardId,
      data: { cardTitle: input.title },
    });
  }
  if (input.dueDate !== undefined) {
    await resetCardRemindersOnDueDateChange(cardId, Boolean(input.dueDate));
    await logActivity({
      boardId,
      cardId,
      userId,
      type: input.dueDate ? 'card.due.set' : 'card.due.clear',
      data: input.dueDate ? { dueDate: input.dueDate } : {},
    });
    if (input.dueDate) {
      await notify({
        recipients: await recipients(),
        actorId: userId,
        type: 'card.due.set',
        boardId,
        cardId,
        data: { cardTitle: card.title, dueDate: input.dueDate },
      });
    }
  }

  emitToBoard(boardId, 'board:lists-changed');
  return finalCard;
}

export async function deleteCard(userId: string, cardId: string) {
  const card = await assertCardAccess(userId, cardId);
  const recipients = await cardMemberIds(cardId);
  await prisma.card.update({
    where: { id: cardId },
    data: { deletedAt: new Date() },
  });
  await notify({
    recipients,
    actorId: userId,
    type: 'card.deleted',
    boardId: card.list.boardId,
    data: { cardTitle: card.title },
  });
}

// Lay the (bat ke da luu tru) + kiem tra quyen sua bang chua no.
async function assertArchivedCard(userId: string, cardId: string) {
  const card = await prisma.card.findFirst({
    where: { id: cardId, deletedAt: null },
    include: { list: { select: { boardId: true, status: true } } },
  });
  if (!card) throw new AppError('Khong tim thay the', 404);
  await assertBoardAccess(userId, card.list.boardId);
  return card;
}

// Luu tru the (co the khoi phuc)
export async function archiveCard(userId: string, cardId: string) {
  const card = await assertCardAccess(userId, cardId);
  await prisma.card.update({
    where: { id: cardId },
    data: { archivedAt: new Date() },
  });
  await logActivity({
    boardId: card.list.boardId,
    cardId,
    userId,
    type: 'card.archive',
  });
}

// Khoi phuc the da luu tru -> dua ve cuoi danh sach. Cot co the da doi trang
// thai trong luc the nam trong kho luu tru -> the doi theo cot khi quay lai.
export async function restoreCard(userId: string, cardId: string) {
  const card = await assertArchivedCard(userId, cardId);
  const last = await prisma.card.findFirst({
    where: { listId: card.listId, deletedAt: null, archivedAt: null },
    orderBy: { position: 'desc' },
    select: { position: true },
  });
  const listStatus = card.list.status;
  const results = await prisma.$transaction([
    prisma.card.update({
      where: { id: cardId },
      data: { archivedAt: null, position: last ? last.position + 1 : 0 },
    }),
    ...(listStatus ? [statusWrite(prisma, { id: cardId }, listStatus)] : []),
  ]);
  await logActivity({
    boardId: card.list.boardId,
    cardId,
    userId,
    type: 'card.restore',
  });
  // updateMany co dieu kien: count = 0 nghia la the von da o dung trang thai
  const statusChanged =
    listStatus !== null && (results[1] as { count: number }).count > 0;
  if (listStatus && statusChanged) {
    await logStatusChange({
      boardId: card.list.boardId,
      cardId,
      cardTitle: card.title,
      userId,
      from: card.status,
      to: listStatus,
      notifyDone: false,
    });
  }
}

// Xoa han the da luu tru
export async function purgeCard(userId: string, cardId: string) {
  const card = await assertArchivedCard(userId, cardId);
  await prisma.card.update({
    where: { id: cardId },
    data: { deletedAt: new Date() },
  });
  emitToBoard(card.list.boardId, 'board:lists-changed');
}

/**
 * Keo tha the: chuyen sang danh sach `listId`, chen vao vi tri `position`.
 */
export async function moveCard(
  userId: string,
  cardId: string,
  input: MoveCardInput,
  // notifyDone: goi tu updateCard (doi tay trang thai) -> gui "da hoan thanh"
  opts: { notifyDone?: boolean } = {}
) {
  const card = await assertCardAccess(userId, cardId);

  const targetList = await prisma.list.findFirst({
    where: { id: input.listId, deletedAt: null, archivedAt: null },
    include: { board: { select: { id: true, name: true } } },
  });
  if (!targetList) {
    throw new AppError('Danh sach dich khong ton tai', 400);
  }
  await assertBoardAccess(userId, targetList.boardId);

  const sourceListId = card.listId;
  const sourceListName = card.list.name;
  const sourceBoardId = card.list.boardId;
  const crossBoard = sourceBoardId !== targetList.boardId;

  const targetCards = await prisma.card.findMany({
    where: {
      listId: input.listId,
      deletedAt: null,
      archivedAt: null,
      id: { not: cardId },
    },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  const index = Math.min(Math.max(input.position, 0), targetCards.length);
  const orderedIds = [
    ...targetCards.slice(0, index).map((c) => c.id),
    cardId,
    ...targetCards.slice(index).map((c) => c.id),
  ];

  const writes: Prisma.PrismaPromise<unknown>[] = orderedIds.map((id, i) =>
    prisma.card.update({
      where: { id },
      data: { position: i, listId: input.listId },
    })
  );

  // Sang cot KHAC co trang thai -> the doi theo cot. Keo doi cho trong cung
  // cot thi khong dong toi trang thai (giu trang thai da doi tay neu co).
  const targetStatus =
    sourceListId !== input.listId ? targetList.status : null;
  const statusWriteIndex = targetStatus
    ? writes.push(statusWrite(prisma, { id: cardId }, targetStatus)) - 1
    : -1;

  if (sourceListId !== input.listId) {
    const remaining = await prisma.card.findMany({
      where: {
        listId: sourceListId,
        deletedAt: null,
        archivedAt: null,
        id: { not: cardId },
      },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      select: { id: true },
    });
    remaining.forEach((c, i) => {
      writes.push(
        prisma.card.update({ where: { id: c.id }, data: { position: i } })
      );
    });
  }

  // Chuyen sang bang khac: don du lieu khong con hop le o bang dich - nhan
  // gan tren the / gan tren muc checklist khong con la thanh vien bang dich
  // thi go ra (khong xoa the); nhan cua the thuoc bang cu cung bi go vi
  // Label la rieng theo tung bang. Gia tri truong tuy chinh cung rieng theo
  // tung bang (CustomField.boardId) nen cung phai go, khong the giu lai vi
  // bang dich khong co dinh nghia truong tuong ung.
  if (crossBoard) {
    writes.push(
      prisma.cardLabel.deleteMany({
        where: { cardId, label: { boardId: { not: targetList.boardId } } },
      }),
      prisma.cardFieldValue.deleteMany({
        where: { cardId, field: { boardId: { not: targetList.boardId } } },
      })
    );

    const [members, items] = await Promise.all([
      prisma.cardMember.findMany({ where: { cardId }, select: { userId: true } }),
      prisma.checklistItem.findMany({
        where: { checklist: { cardId }, assigneeId: { not: null } },
        select: { id: true, assigneeId: true },
      }),
    ]);
    const staleMemberIds = (
      await Promise.all(
        members.map(async (m) => ({
          userId: m.userId,
          stale: !(await isBoardParticipant(targetList.boardId, m.userId)),
        }))
      )
    )
      .filter((m) => m.stale)
      .map((m) => m.userId);
    if (staleMemberIds.length > 0) {
      writes.push(
        prisma.cardMember.deleteMany({
          where: { cardId, userId: { in: staleMemberIds } },
        })
      );
    }

    const distinctAssigneeIds = [
      ...new Set(items.map((it) => it.assigneeId as string)),
    ];
    const staleAssigneeIds = new Set(
      (
        await Promise.all(
          distinctAssigneeIds.map(async (uid) => ({
            uid,
            stale: !(await isBoardParticipant(targetList.boardId, uid)),
          }))
        )
      )
        .filter((a) => a.stale)
        .map((a) => a.uid)
    );
    const staleItemIds = items
      .filter((it) => staleAssigneeIds.has(it.assigneeId as string))
      .map((it) => it.id);
    if (staleItemIds.length > 0) {
      writes.push(
        prisma.checklistItem.updateMany({
          where: { id: { in: staleItemIds } },
          data: { assigneeId: null },
        })
      );
    }
  }

  const results = await prisma.$transaction(writes);
  // updateMany co dieu kien: count = 0 nghia la the von da o dung trang thai
  const statusChanged =
    statusWriteIndex >= 0 &&
    (results[statusWriteIndex] as { count: number }).count > 0;

  if (sourceListId !== input.listId) {
    await logActivity({
      boardId: targetList.boardId,
      cardId,
      userId,
      type: 'card.move',
      data: crossBoard
        ? {
            fromList: sourceListName,
            toList: targetList.name,
            toBoard: targetList.board.name,
          }
        : { fromList: sourceListName, toList: targetList.name },
    });
    if (statusChanged && targetStatus) {
      await logStatusChange({
        boardId: targetList.boardId,
        cardId,
        cardTitle: card.title,
        userId,
        from: card.status,
        to: targetStatus,
        // Keo tha: da co thong bao "card.moved" ben duoi, khong gui them
        notifyDone: opts.notifyDone ?? false,
      });
    }
    await notify({
      recipients: await cardMemberIds(cardId),
      actorId: userId,
      type: 'card.moved',
      boardId: targetList.boardId,
      cardId,
      data: {
        cardTitle: card.title,
        toList: crossBoard
          ? `${targetList.board.name} / ${targetList.name}`
          : targetList.name,
      },
    });
    await runAutomationsForCard(
      'CARD_MOVED_TO_LIST',
      cardId,
      card.title,
      targetList.boardId,
      input.listId
    );
  }

  // Ke ca keo trong cung danh sach (khong ghi log) van bao realtime.
  // Chuyen xuyen bang: bao ca 2 phia, phia nguon can biet the vua "bien mat".
  emitToBoard(targetList.boardId, 'board:lists-changed');
  if (crossBoard) {
    emitToBoard(sourceBoardId, 'board:lists-changed');
  }
  return prisma.card.findFirst({ where: { id: cardId } });
}
