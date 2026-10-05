import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBoards } from '../context/BoardsContext';
import { useWorkspaces } from '../context/WorkspacesContext';
import {
  createBoardFromTemplate,
  fetchTemplates,
  type BoardTemplate,
} from '../lib/api/board';
import {
  createBoardFromUserTemplate,
  deleteUserBoardTemplate,
  fetchUserBoardTemplates,
} from '../lib/api/boardTemplate';
import { Skeleton, SkeletonRegion } from '../components/Skeleton';
import { getErrorMessage } from '../lib/errorMessage';
import { logError } from '../lib/logError';
import type { UserBoardTemplate } from '../types/boardTemplate';

// Hình xem trước bảng mẫu: nền màu của mẫu, mỗi cột một khung, mỗi thẻ ví dụ (tối đa 3) một thanh
function TemplatePreview({ color, lists }: { color: string; lists: { name: string; cards: unknown[] }[] }) {
  const widths = ['100%', '82%', '92%'];
  return (
    <div
      aria-hidden="true"
      className="flex h-24 items-start gap-1.5 overflow-hidden px-3 pt-3"
      style={{ backgroundColor: color }}
    >
      {lists.slice(0, 4).map((l) => (
        <div key={l.name} className="flex min-w-0 flex-1 flex-col gap-1 rounded-md bg-white/70 p-1.5 dark:bg-slate-900/60">
          <span className="h-1.5 w-2/3 rounded-full bg-slate-500/50" />
          {Array.from({ length: Math.min(3, l.cards.length) }, (_, i) => (
            <span
              key={i}
              className="block h-3 rounded bg-white shadow-sm dark:bg-slate-700"
              style={{ width: widths[i] }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function TemplatesPage() {
  const navigate = useNavigate();
  const { upsertBoard } = useBoards();
  const { workspaces, currentWorkspaceId } = useWorkspaces();
  const [targetWorkspaceId, setTargetWorkspaceId] = useState('');
  const [templates, setTemplates] = useState<BoardTemplate[]>([]);
  const [userTemplates, setUserTemplates] = useState<UserBoardTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchTemplates()
      .then(setTemplates)
      .catch((err) => setError(getErrorMessage(err, 'Không tải được mẫu.')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!targetWorkspaceId && currentWorkspaceId) {
      setTargetWorkspaceId(currentWorkspaceId);
    }
  }, [targetWorkspaceId, currentWorkspaceId]);

  const wsId = targetWorkspaceId || currentWorkspaceId;
  const loadUserTemplates = useCallback(() => {
    if (!wsId) return;
    fetchUserBoardTemplates(wsId)
      .then(setUserTemplates)
      .catch(logError('TemplatesPage: tai mau cua ban'));
  }, [wsId]);
  useEffect(() => {
    loadUserTemplates();
  }, [loadUserTemplates]);

  async function use(t: BoardTemplate) {
    if (!wsId) {
      setError('Hãy chọn không gian làm việc.');
      return;
    }
    setCreating(t.id);
    setError(null);
    try {
      const board = await createBoardFromTemplate(t.id, wsId);
      upsertBoard(board);
      navigate(`/boards/${board.id}`);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tạo được bảng từ mẫu.'));
      setCreating(null);
    }
  }

  async function handleUseUserTemplate(t: UserBoardTemplate) {
    if (!wsId) {
      setError('Hãy chọn không gian làm việc.');
      return;
    }
    setCreating(t.id);
    setError(null);
    try {
      const board = await createBoardFromUserTemplate(wsId, t.id);
      upsertBoard(board);
      navigate(`/boards/${board.id}`);
    } catch (err) {
      setError(getErrorMessage(err, 'Không tạo được bảng từ mẫu.'));
      setCreating(null);
    }
  }

  async function removeUserTemplate(t: UserBoardTemplate) {
    setDeletingId(t.id);
    try {
      await deleteUserBoardTemplate(t.id);
      setUserTemplates((cur) => cur.filter((x) => x.id !== t.id));
    } catch (err) {
      setError(getErrorMessage(err, 'Không xoá được mẫu.'));
    } finally {
      setDeletingId(null);
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

      {workspaces.length > 1 && (
        <label className="mb-4 flex max-w-sm items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          Tạo trong không gian:
          <select
            value={targetWorkspaceId}
            onChange={(e) => setTargetWorkspaceId(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-primary focus:outline-none dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      {userTemplates.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Mẫu của bạn
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {userTemplates.map((t) => {
              const cardCount = t.lists.reduce((n, l) => n + l.cards.length, 0);
              return (
                <div
                  key={t.id}
                  className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  <TemplatePreview color={t.color} lists={t.lists} />
                  <div className="flex flex-1 flex-col p-4">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {t.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      Tạo bởi {t.createdBy.name}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {t.lists.map((l) => (
                        <span
                          key={l.id}
                          className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                        >
                          {l.name}
                        </span>
                      ))}
                    </div>

                    <p className="mt-2 text-[11px] text-slate-400">
                      {t.lists.length} cột · {cardCount} thẻ
                    </p>

                    <div className="mt-auto flex gap-2 pt-4">
                      <button
                        type="button"
                        disabled={creating !== null}
                        onClick={() => handleUseUserTemplate(t)}
                        className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
                      >
                        {creating === t.id ? 'Đang tạo...' : 'Dùng mẫu này'}
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === t.id}
                        onClick={() => removeUserTemplate(t)}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-500/10"
                      >
                        Xoá
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <h2 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
        Mẫu có sẵn
      </h2>
      {loading ? (
        <SkeletonRegion label="Đang tải mẫu…" className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </SkeletonRegion>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((t) => {
            const cardCount = t.lists.reduce((n, l) => n + l.cards.length, 0);
            return (
              <div
                key={t.id}
                className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
              >
                <TemplatePreview color={t.color} lists={t.lists} />
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
                      className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
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
