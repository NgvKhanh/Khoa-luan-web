import { useLocation } from 'react-router-dom';
import { useAssistant } from '../../context/AssistantContext';
import { useBoards } from '../../context/BoardsContext';
import { useWorkspaces } from '../../context/WorkspacesContext';
import { defaultScopeFor } from '../../lib/chatText';
import type { ChatScope } from '../../types/chat';

/**
 * Bo chon pham vi: Việc của tôi / Không gian / Bảng (§13). Mac dinh theo trang dang mo (xem
 * AssistantContext). "Bảng" chi chon duoc khi dang o trang mot bang (hoac pham vi dang la bang).
 */
export default function ScopePicker() {
  const { scope, setScope, turns, busy } = useAssistant();
  const { boards } = useBoards();
  const { workspaces, currentWorkspaceId } = useWorkspaces();
  const page = defaultScopeFor(useLocation().pathname);

  const boardId = scope.kind === 'BOARD' ? scope.boardId : page.kind === 'BOARD' ? page.boardId : null;
  const board = boards.find((b) => b.id === boardId);
  const workspaceId =
    scope.kind === 'WORKSPACE'
      ? scope.workspaceId
      : page.kind === 'WORKSPACE'
        ? page.workspaceId
        : (board?.workspaceId ?? currentWorkspaceId ?? workspaces[0]?.id ?? null);
  const workspace = workspaces.find((w) => w.id === workspaceId);

  const options: { kind: ChatScope['kind']; label: string; value: ChatScope | null; disabledHint?: string }[] = [
    { kind: 'MY', label: 'Việc của tôi', value: { kind: 'MY' } },
    {
      kind: 'WORKSPACE',
      label: 'Không gian',
      value: workspaceId ? { kind: 'WORKSPACE', workspaceId } : null,
      disabledHint: 'Bạn chưa có không gian làm việc nào',
    },
    {
      kind: 'BOARD',
      label: 'Bảng',
      value: boardId ? { kind: 'BOARD', boardId } : null,
      disabledHint: 'Mở một bảng để hỏi riêng về bảng đó',
    },
  ];

  const caption =
    scope.kind === 'MY'
      ? 'Việc của bạn trên mọi bảng bạn xem được.'
      : scope.kind === 'WORKSPACE'
        ? `Các bảng bạn xem được trong không gian “${workspace?.name ?? 'đã chọn'}”.`
        : `Bảng “${board?.name ?? 'đã chọn'}”.`;

  return (
    <div className="border-b border-slate-200 px-4 py-2.5 dark:border-slate-700">
      <div role="radiogroup" aria-label="Phạm vi câu hỏi" className="flex gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
        {options.map((o) => {
          const checked = scope.kind === o.kind;
          return (
            <button
              key={o.kind}
              type="button"
              role="radio"
              aria-checked={checked}
              disabled={!o.value || busy}
              title={o.value ? undefined : o.disabledHint}
              onClick={() => o.value && !checked && setScope(o.value)}
              className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
                checked
                  ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      {scope.kind === 'WORKSPACE' && workspaces.length > 1 && (
        <select
          aria-label="Chọn không gian"
          value={scope.workspaceId}
          disabled={busy}
          onChange={(e) => setScope({ kind: 'WORKSPACE', workspaceId: e.target.value })}
          className="mt-2 w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      )}

      <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        {caption}
        {turns.length > 0 && ' Đổi phạm vi thì câu tiếp theo sẽ không nối tiếp câu trước.'}
      </p>
    </div>
  );
}
