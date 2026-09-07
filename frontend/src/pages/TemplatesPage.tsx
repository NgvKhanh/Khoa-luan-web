import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBoards } from '../context/BoardsContext';
import {
  createBoardFromTemplate,
  fetchTemplates,
  type BoardTemplate,
} from '../lib/api/board';
import { getErrorMessage } from '../lib/errorMessage';

export default function TemplatesPage() {
  const navigate = useNavigate();
  const { upsertBoard } = useBoards();
  const [templates, setTemplates] = useState<BoardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates()
      .then(setTemplates)
      .catch((err) => setError(getErrorMessage(err, 'Không tải được mẫu.')))
      .finally(() => setLoading(false));
  }, []);

  async function use(t: BoardTemplate) {
    setCreating(t.id);
    setError(null);
    try {
      const board = await createBoardFromTemplate(t.id);
      upsertBoard(board);
      navigate(`/boards/${board.id}`);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tạo được bảng từ mẫu.'));
      setCreating(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
        Mẫu bảng
      </h1>
      <p className="mb-4 mt-0.5 text-sm text-slate-500 dark:text-slate-400">
        Chọn một mẫu để tạo ngay một bảng đã có sẵn các cột và thẻ ví dụ.
      </p>

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-slate-500">Đang tải...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((t) => {
            const cardCount = t.lists.reduce((n, l) => n + l.cards.length, 0);
            return (
              <div
                key={t.id}
                className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="h-2" style={{ backgroundColor: t.color }} />
                <div className="flex flex-1 flex-col p-4">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {t.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {t.description}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {t.lists.map((l) => (
                      <span
                        key={l.name}
                        className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                      >
                        {l.name}
                      </span>
                    ))}
                  </div>

                  <p className="mt-2 text-[11px] text-slate-400">
                    {t.lists.length} cột · {cardCount} thẻ ví dụ
                  </p>

                  <div className="mt-auto pt-4">
                    <button
                      type="button"
                      disabled={creating !== null}
                      onClick={() => use(t)}
                      className="rounded-lg bg-[#0c66e4] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#0a5cd4] disabled:opacity-50"
                    >
                      {creating === t.id ? 'Đang tạo...' : 'Dùng mẫu này'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
