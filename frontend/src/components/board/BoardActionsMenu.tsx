import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { archiveBoard, deleteBoard, exportBoard } from '../../lib/api/board';
import { getErrorMessage } from '../../lib/errorMessage';

interface Props {
  boardId: string;
  boardName: string;
  isOwner: boolean;
  onClose: () => void;
  onArchived: () => void;
  onDeleted: () => void;
}

function slugify(s: string): string {
  return (
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[đĐ]/g, 'd')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'bang'
  );
}

export default function BoardActionsMenu({
  boardId,
  boardName,
  isOwner,
  onClose,
  onArchived,
  onDeleted,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<'export' | 'archive' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (
        ref.current &&
        !ref.current.contains(t) &&
        !t.closest('[data-board-menu-trigger]')
      ) {
        onClose();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  async function doExport() {
    setBusy('export');
    setError(null);
    try {
      const data = await exportBoard(boardId);
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${slugify(boardName)}-${new Date()
        .toISOString()
        .slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Không xuất được bảng.'));
    } finally {
      setBusy(null);
    }
  }

  async function doArchive() {
    setBusy('archive');
    setError(null);
    try {
      await archiveBoard(boardId);
      onArchived();
    } catch (err) {
      setError(getErrorMessage(err, 'Không lưu trữ được bảng.'));
      setBusy(null);
    }
  }

  async function doDelete() {
    setBusy('delete');
    setError(null);
    try {
      await deleteBoard(boardId);
      onDeleted();
    } catch (err) {
      setError(getErrorMessage(err, 'Không xoá được bảng.'));
      setBusy(null);
    }
  }

  if (confirmDelete) {
    return createPortal(
      <div
        ref={ref}
        className="fixed right-3 top-14 z-50 w-64 rounded-xl border border-slate-200 bg-white p-3 text-slate-800 shadow-2xl"
      >
        <p className="text-sm font-semibold text-red-600">Xoá bảng này?</p>
        <p className="mt-1 text-xs text-slate-500">
          Bảng "{boardName}" cùng toàn bộ danh sách và thẻ sẽ bị xoá vĩnh viễn,
          không thể khôi phục. Nếu chỉ muốn cất đi, hãy chọn "Lưu trữ bảng".
        </p>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={doDelete}
            className="flex-1 rounded-lg bg-red-600 py-1.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy === 'delete' ? 'Đang xoá...' : 'Xoá vĩnh viễn'}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => setConfirmDelete(false)}
            className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Huỷ
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      ref={ref}
      className="fixed right-3 top-14 z-50 w-60 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-800 shadow-2xl"
    >
      <p className="px-2 pb-1 pt-0.5 text-center text-sm font-semibold">
        Thao tác với bảng
      </p>
      {error && <p className="px-2 pb-1 text-xs text-red-600">{error}</p>}

      <button
        type="button"
        disabled={busy !== null}
        onClick={doExport}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3v12M8 11l4 4 4-4M4 21h16" />
        </svg>
        {busy === 'export' ? 'Đang xuất...' : 'Xuất bảng (JSON)'}
      </button>

      {isOwner && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={doArchive}
          className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="4" rx="1" />
            <path d="M5 8v11a1 1 0 001 1h12a1 1 0 001-1V8M10 12h4" />
          </svg>
          {busy === 'archive' ? 'Đang lưu trữ...' : 'Lưu trữ bảng'}
        </button>
      )}

      {isOwner && (
        <>
          <div className="my-1 border-t border-slate-200" />
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              setError(null);
              setConfirmDelete(true);
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
            Xoá bảng
          </button>
        </>
      )}
    </div>,
    document.body
  );
}
