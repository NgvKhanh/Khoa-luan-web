import { useEffect, type MutableRefObject } from 'react';
import { logError } from '../../../lib/logError';
import { socket } from '../../../lib/socket';

interface Options {
  /** Tai lai chi tiet the (da bao boc bang useCallback o CardModal). */
  reload: () => Promise<unknown>;
  /** true khi dang go tieu de / mo ta -> khong ghi de ban nhap. */
  editingRef: MutableRefObject<boolean>;
  /** boardId cua the dang mo -> loc su kien cua bang khac. */
  boardIdRef: MutableRefObject<string | null>;
}

/**
 * Nghe socket `board:lists-changed`: khi nguoi khac binh luan / sua the tren
 * CUNG bang thi tai lai the (gop 400ms). Tach khoi CardModal cho gon.
 */
export function useCardRealtime({ reload, editingRef, boardIdRef }: Options) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onBoardChanged = (payload?: { boardId?: string }) => {
      if (
        boardIdRef.current &&
        payload?.boardId &&
        payload.boardId !== boardIdRef.current
      ) {
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (editingRef.current) return; // dang go -> khong ghi de ban nhap
        void reload().catch(logError('CardModal realtime: tai lai the'));
      }, 400);
    };
    socket.on('board:lists-changed', onBoardChanged);
    return () => {
      clearTimeout(timer);
      socket.off('board:lists-changed', onBoardChanged);
    };
  }, [reload, editingRef, boardIdRef]);
}
