import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// ----- Mock API + socket -----
const fetchBoardMock = vi.fn().mockResolvedValue({
  id: 'b1',
  canManage: true,
  visibility: 'WORKSPACE',
});
const fetchBoardMembersMock = vi.fn().mockResolvedValue([]);
vi.mock('../../lib/api/board', () => ({
  fetchBoard: (...a: unknown[]) =>
    (fetchBoardMock as (...a: unknown[]) => Promise<unknown>)(...a),
  fetchBoardMembers: (...a: unknown[]) =>
    (fetchBoardMembersMock as (...a: unknown[]) => Promise<unknown>)(...a),
}));
vi.mock('../../lib/api/list', () => ({
  fetchBoardLists: vi.fn().mockResolvedValue([]),
}));

const socketHandlers = new Map<string, ((...a: unknown[]) => void)[]>();
vi.mock('../../lib/socket', () => ({
  socket: {
    emit: () => {},
    on: (ev: string, fn: (...a: unknown[]) => void) => {
      socketHandlers.set(ev, [...(socketHandlers.get(ev) ?? []), fn]);
    },
    off: (ev: string, fn: (...a: unknown[]) => void) => {
      socketHandlers.set(
        ev,
        (socketHandlers.get(ev) ?? []).filter((f) => f !== fn)
      );
    },
  },
}));
function emitSocket(ev: string, payload?: unknown) {
  for (const fn of socketHandlers.get(ev) ?? []) fn(payload);
}

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

import { useBoardRealtime } from './useBoardRealtime';

// Van de moi (vong 3) #4: doi vai tro trong KHONG GIAN LAM VIEC phai lam
// canManage cua bang dang mo tai lai theo, khong chi board:members-changed.
describe('#4 (vong 3) useBoardRealtime phai nghe workspace:changed', () => {
  it('workspace:changed -> tai lai chi tiet bang (canManage co the vua doi)', async () => {
    socketHandlers.clear();
    fetchBoardMock.mockClear();

    renderHook(() =>
      useBoardRealtime({
        boardId: 'b1',
        patchBoard: () => {},
        setLists: () => {},
        setMembers: () => {},
        setFetchedBoard: () => {},
        setOnlineIds: () => {},
        draggingRef: { current: false },
        pendingReloadRef: { current: false },
      })
    );

    expect(fetchBoardMock).not.toHaveBeenCalled();
    emitSocket('workspace:changed', { workspaceId: 'w1' });
    // fetchBoard() duoc goi ngay (khong debounce nhu lists-changed)
    await Promise.resolve();
    await Promise.resolve();

    expect(fetchBoardMock).toHaveBeenCalledWith('b1');
  });
});
