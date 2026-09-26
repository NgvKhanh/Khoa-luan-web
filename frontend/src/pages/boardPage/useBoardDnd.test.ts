import { act, renderHook } from '@testing-library/react';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import type { BoardList } from '../../types/list';
import type { Card } from '../../types/card';

const moveCardMock = vi.fn();
vi.mock('../../lib/api/card', () => ({
  moveCard: (...a: unknown[]) => (moveCardMock as (...a: unknown[]) => Promise<unknown>)(...a),
}));
vi.mock('../../lib/api/list', () => ({
  reorderList: vi.fn(),
}));

import { useBoardDnd } from './useBoardDnd';

function card(id: string, listId: string): Card {
  return {
    id,
    listId,
    title: id,
    description: null,
    status: 'TODO',
    isDone: false,
    position: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function cardDrag(id: string): DragStartEvent {
  return { active: { id, data: { current: { type: 'card' } } } } as unknown as DragStartEvent;
}
function overOnList(activeId: string, listId: string): DragOverEvent {
  return {
    active: { id: activeId, data: { current: { type: 'card' } } },
    over: { id: `list-${listId}`, data: { current: { type: 'list' } } },
  } as unknown as DragOverEvent;
}
function endOnList(activeId: string, listId: string): DragEndEvent {
  return {
    active: { id: activeId, data: { current: { type: 'card' } } },
    over: { id: `list-${listId}`, data: { current: { type: 'list' } } },
  } as unknown as DragEndEvent;
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function useHarness(initial: BoardList[]) {
  const [lists, setLists] = useState(initial);
  const [listsError, setListsError] = useState<string | null>(null);
  const draggingRef = useRef(false);
  const pendingReloadRef = useRef(false);
  const reloadLists = vi.fn();
  const dnd = useBoardDnd({
    lists,
    setLists,
    reloadLists,
    setListsError,
    draggingRef,
    pendingReloadRef,
  });
  return { lists, listsError, reloadLists, ...dnd };
}

// CODE_REVIEW.md #10: listsSnapshotRef la MOT ref dung chung cho moi luot keo the.
// Keo A sang L2 (request luu con dang cho) roi bat dau keo B sang L2; khi request A
// xong (thanh cong) va sau do B bi huy, snapshot cua B phai duoc khoi phuc dung -
// KHONG duoc de request A (da xong truoc) xoa mat snapshot cua B.
describe('useBoardDnd: snapshot keo-tha khong bi luot keo MOI hon lam mat (#10)', () => {
  it('keo A sang L2 (dang cho luu) -> bat dau keo B sang L2 -> A luu xong -> huy B: B tro ve L1, A giu nguyen o L2', async () => {
    moveCardMock.mockReset();
    const { promise: moveA, resolve: resolveMoveA } = deferred<Card>();
    moveCardMock.mockReturnValueOnce(moveA);

    const initial: BoardList[] = [
      { id: 'L1', boardId: 'b1', name: 'L1', position: 0, status: null, createdAt: '', updatedAt: '', cards: [card('A', 'L1'), card('B', 'L1')] },
      { id: 'L2', boardId: 'b1', name: 'L2', position: 1, status: null, createdAt: '', updatedAt: '', cards: [] },
    ];
    const { result } = renderHook(() => useHarness(initial));

    // Keo A sang L2 (lay snapshot ban dau, the he 1)
    act(() => result.current.handleDragStart(cardDrag('A')));
    act(() => result.current.handleDragOver(overOnList('A', 'L2')));
    expect(result.current.lists.find((l) => l.id === 'L1')!.cards.map((c) => c.id)).toEqual(['B']);
    expect(result.current.lists.find((l) => l.id === 'L2')!.cards.map((c) => c.id)).toEqual(['A']);

    let endPromise!: Promise<void>;
    act(() => {
      endPromise = result.current.handleDragEnd(endOnList('A', 'L2'));
    });

    // Trong luc request cua A CON DANG CHO: bat dau keo B sang L2 (the he 2,
    // ghi de listsSnapshotRef).
    act(() => result.current.handleDragStart(cardDrag('B')));
    act(() => result.current.handleDragOver(overOnList('B', 'L2')));
    expect(result.current.lists.find((l) => l.id === 'L1')!.cards).toHaveLength(0);
    expect(result.current.lists.find((l) => l.id === 'L2')!.cards.map((c) => c.id)).toEqual(['A', 'B']);

    // Request cua A xong (thanh cong)
    await act(async () => {
      resolveMoveA(card('A', 'L2'));
      await endPromise;
    });

    // Nguoi dung HUY luot keo B (vd tha ra ngoai / nhan Esc)
    act(() => result.current.handleDragCancel());

    const l1 = result.current.lists.find((l) => l.id === 'L1')!.cards.map((c) => c.id);
    const l2 = result.current.lists.find((l) => l.id === 'L2')!.cards.map((c) => c.id);
    // B phai tro ve L1 (luot keo cua no bi huy, chua bao gio luu); A phai o lai L2
    // (da luu thanh cong that su o server).
    expect(l1).toEqual(['B']);
    expect(l2).toEqual(['A']);
  });
});

// Trang thai theo cot: trong luc keo, the doi trang thai TAM theo cot dang di qua
// (giong ket qua backend se tra ve); ve lai cot cu / vao cot tu do thi giu trang thai ban dau.
describe('useBoardDnd: trang thai tam cua the khi keo qua cac cot', () => {
  it('keo qua cot DONE -> tam thanh DONE; di tiep sang cot tu do / ve cot cu -> lay lai trang thai ban dau', () => {
    const blocked: Card = { ...card('A', 'L1'), status: 'BLOCKED' };
    const initial: BoardList[] = [
      { id: 'L1', boardId: 'b1', name: 'L1', position: 0, status: 'IN_PROGRESS', createdAt: '', updatedAt: '', cards: [blocked] },
      { id: 'L2', boardId: 'b1', name: 'L2', position: 1, status: 'DONE', createdAt: '', updatedAt: '', cards: [] },
      { id: 'L3', boardId: 'b1', name: 'L3', position: 2, status: null, createdAt: '', updatedAt: '', cards: [] },
    ];
    const { result } = renderHook(() => useHarness(initial));
    const cardIn = (listId: string) => result.current.lists.find((l) => l.id === listId)!.cards[0]!;

    act(() => result.current.handleDragStart(cardDrag('A')));
    act(() => result.current.handleDragOver(overOnList('A', 'L2')));
    expect(cardIn('L2')).toMatchObject({ status: 'DONE', isDone: true });

    act(() => result.current.handleDragOver(overOnList('A', 'L3')));
    expect(cardIn('L3')).toMatchObject({ status: 'BLOCKED', isDone: false });

    act(() => result.current.handleDragOver(overOnList('A', 'L1')));
    // Ve lai cot cu: giu trang thai da doi tay (BLOCKED), KHONG lay IN_PROGRESS cua cot
    expect(cardIn('L1')).toMatchObject({ status: 'BLOCKED', isDone: false });
  });
});
