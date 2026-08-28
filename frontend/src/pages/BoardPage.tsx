import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useOutletContext, useParams } from 'react-router-dom';
import type { BoardOutletContext } from '../layouts/BoardViewLayout';
import { updateBoard } from '../lib/api/board';
import { assetUrl } from '../lib/assets';
import { getErrorMessage } from '../lib/errorMessage';

export default function BoardPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const { boards, isLoading, error, patchBoard } =
    useOutletContext<BoardOutletContext>();
  const board = boards.find((b) => b.id === boardId);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  async function saveName() {
    if (!board) return;
    const name = draft.trim();
    setEditing(false);
    if (!name || name === board.name) return;
    try {
      const updated = await updateBoard(board.id, { name });
      patchBoard(updated);
    } catch (err) {
      setSaveError(getErrorMessage(err, 'Không đổi được tên bảng.'));
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') saveName();
    if (e.key === 'Escape') setEditing(false);
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    saveName();
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-slate-500">Đang tải bảng...</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600">{error}</div>;
  }

  if (!board) {
    return (
      <div className="p-6">
        <p className="text-sm text-slate-600">Không tìm thấy bảng này.</p>
        <Link to="/" className="mt-2 inline-block text-sm font-medium text-[#0c66e4] hover:underline">
          ← Về danh sách bảng
        </Link>
      </div>
    );
  }

  const canvasStyle = board.backgroundImage
    ? {
        backgroundImage: `url(${assetUrl(board.backgroundImage)})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : { backgroundColor: board.color };

  return (
    <div className="flex h-full flex-col" style={canvasStyle}>
      {/* Thanh ten bang */}
      <div className="flex items-center gap-3 bg-black/25 px-4 py-2 backdrop-blur-sm">
        {editing ? (
          <form onSubmit={onSubmit}>
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveName}
              onKeyDown={onKeyDown}
              className="rounded bg-white px-2 py-1 text-lg font-bold text-slate-900 focus:outline-none"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setDraft(board.name);
              setEditing(true);
            }}
            className="rounded px-2 py-1 text-lg font-bold text-white hover:bg-white/20"
          >
            {board.name}
          </button>
        )}
      </div>

      {saveError && (
        <p className="mx-4 mt-2 w-fit rounded bg-red-600/90 px-3 py-1 text-sm text-white">
          {saveError}
        </p>
      )}

      {/* Vung canvas - danh sach & the se lam o buoc sau */}
      <div className="flex-1 overflow-auto p-4">
        <div className="w-72 rounded-xl bg-white/85 p-4 text-sm text-slate-600 shadow">
          Bảng này chưa có danh sách. Chức năng <b>danh sách</b> và <b>thẻ</b> sẽ
          được thêm ở bước tiếp theo.
        </div>
      </div>
    </div>
  );
}
