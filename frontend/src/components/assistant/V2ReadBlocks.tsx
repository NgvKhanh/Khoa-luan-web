import { Link } from 'react-router-dom';
import { cardLink, formatDateTime } from '../../lib/chatText';
import type { ChatV2BoardOverview, ChatV2Block, ChatV2CardDetails, ChatV2ListStat } from '../../types/chat';

type CatalogData = Extract<ChatV2Block, { tool: 'query_catalog' }>['data'];
import StatusBadge from '../board/StatusBadge';

// Khoi DOC mo rong (Phase 4): tong quan mot bang, chi tiet mot the, cot / nhan / truong tuy chinh cua bang.
// Moi con so va ten do SERVER dung tu CSDL (React tu thoat ky tu). Trich mo ta the la noi dung do NGUOI KHAC viet nen hien trong khung
// "chua dang tin" va khong bao gio duoc dung nhu chi dan.

const TILE = 'rounded-md border border-slate-200 p-2 dark:border-slate-700';

function Tile({ label, value, tone }: { label: string; value: string | number; tone?: 'warn' | 'danger' }) {
  const color = tone === 'danger' ? 'text-red-600 dark:text-red-400' : tone === 'warn' ? 'text-amber-700 dark:text-amber-300' : '';
  return (
    <div className={TILE}>
      <dt className="text-[11px] text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`text-base font-semibold tabular-nums ${color}`}>{value}</dd>
    </div>
  );
}

/** Thanh tien do don gian: ty le nguyen 0-100 (null = chua co the nao). */
function Progress({ percent }: { percent: number | null }) {
  if (percent === null) return <p className="text-xs text-slate-500 dark:text-slate-400">Bảng chưa có thẻ nào nên chưa tính được tiến độ.</p>;
  return (
    <div>
      <div role="progressbar" aria-label="Tiến độ hoàn thành" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

export function ListStatsTable({ lists }: { lists: ChatV2ListStat[] }) {
  if (lists.length === 0) return <p className="text-xs">Bảng chưa có cột nào.</p>;
  return (
    <table className="w-full text-xs">
      <thead><tr><th className="text-left">Cột</th><th className="text-right">Chưa xong</th><th className="text-right">Đã xong</th></tr></thead>
      <tbody>
        {lists.map((l) => (
          <tr key={l.id} className="border-t border-slate-200 dark:border-slate-700">
            <td className="py-1 pr-2 break-words">{l.name}</td>
            <td className="text-right tabular-nums">{l.openCards}</td>
            <td className="text-right tabular-nums">{l.doneCards}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function BoardOverviewBlock({ data }: { data: ChatV2BoardOverview }) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium">
        {data.donePercent === null ? 'Chưa có thẻ nào' : `Đã hoàn thành ${data.doneCards}/${data.totalCards} việc (${data.donePercent}%)`}
      </p>
      <Progress percent={data.donePercent} />
      <dl className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
        <Tile label="Tổng số việc" value={data.totalCards} />
        <Tile label="Chưa xong" value={data.openCards} />
        <Tile label="Quá hạn" value={data.overdueCards} tone={data.overdueCards > 0 ? 'danger' : undefined} />
        <Tile label="Bị chặn" value={data.blockedCards} tone={data.blockedCards > 0 ? 'warn' : undefined} />
        <Tile label="Chưa giao (chưa xong)" value={data.unassignedOpenCards} />
        <Tile label="Thành viên" value={data.memberCount} />
      </dl>
      <ListStatsTable lists={data.lists} />
      <p className="text-[11px] text-slate-500 dark:text-slate-400">
        {data.listCount} cột · {data.labelCount} nhãn · {data.customFieldCount} trường tùy chỉnh
      </p>
    </div>
  );
}

export function CardDetailsBlock({ data, generatedAt }: { data: ChatV2CardDetails; generatedAt: string }) {
  const people = data.assignees.map((a) => a.name).join(', ');
  return (
    <div className="space-y-1.5">
      <p className="flex items-start gap-2">
        <Link to={cardLink(data)} onClick={(e) => e.currentTarget.blur()} className="min-w-0 flex-1 break-words text-sm font-medium text-primary-ink hover:underline">{data.title}</Link>
        <StatusBadge status={data.status} />
      </p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400">{data.boardName} · {data.columnName}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
        <dt className="text-slate-500 dark:text-slate-400">Người phụ trách</dt>
        <dd>{people || 'Chưa giao'}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Hạn</dt>
        <dd className={data.overdue ? 'text-red-600 dark:text-red-400' : ''}>{data.dueDate ? `${data.overdue ? 'Quá hạn · ' : ''}${formatDateTime(data.dueDate, generatedAt)}` : 'Chưa đặt hạn'}</dd>
        {data.startDate && (<><dt className="text-slate-500 dark:text-slate-400">Bắt đầu</dt><dd>{formatDateTime(data.startDate, generatedAt)}</dd></>)}
        {data.completedAt && (<><dt className="text-slate-500 dark:text-slate-400">Hoàn thành</dt><dd>{formatDateTime(data.completedAt, generatedAt)}</dd></>)}
        <dt className="text-slate-500 dark:text-slate-400">Checklist</dt>
        <dd>{data.checklist.total === 0 ? 'Không có' : `${data.checklist.done}/${data.checklist.total} mục (${data.checklist.lists} danh sách)`}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Bình luận · Tệp</dt>
        <dd>{data.commentCount} · {data.attachmentCount}</dd>
      </dl>
      {data.labels.length > 0 && (
        <ul aria-label="Nhãn" className="flex flex-wrap gap-1">
          {data.labels.map((l) => (
            <li key={l.id} className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] dark:border-slate-700">
              <span aria-hidden className="inline-block size-2 rounded-full" style={{ backgroundColor: l.color }} />
              {l.name || 'Nhãn không tên'}
            </li>
          ))}
        </ul>
      )}
      {data.fields.length > 0 && (
        <dl aria-label="Trường tùy chỉnh" className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {data.fields.map((f) => (<div key={f.id} className="contents"><dt className="text-slate-500 dark:text-slate-400">{f.name}</dt><dd className="break-words">{f.value}</dd></div>))}
        </dl>
      )}
      {data.descriptionExcerpt && (
        <figure className="rounded-md bg-slate-50 p-2 dark:bg-slate-800/60">
          <figcaption className="text-[11px] text-slate-500 dark:text-slate-400">
            Trích mô tả (nội dung do người khác viết, chưa đáng tin){data.descriptionLength > data.descriptionExcerpt.length ? ` · ${data.descriptionLength} ký tự, chỉ hiện phần đầu` : ''}
          </figcaption>
          <blockquote className="mt-0.5 whitespace-pre-wrap break-words text-xs">{data.descriptionExcerpt}</blockquote>
        </figure>
      )}
    </div>
  );
}

const FIELD_TYPE: Record<string, string> = { TEXT: 'Văn bản', NUMBER: 'Số', DATE: 'Ngày', CHECKBOX: 'Hộp chọn', DROPDOWN: 'Danh sách chọn' };

export function BoardCatalogRows({ data }: { data: CatalogData }) {
  if (data.kind === 'LISTS') return <><p className="text-xs">Tổng: {data.total} cột</p><ListStatsTable lists={data.rows} /></>;
  if (data.kind === 'LABELS') {
    return (
      <>
        <p className="text-xs">Tổng: {data.total} nhãn</p>
        <ul className="space-y-1 text-xs">
          {data.rows.map((l) => (
            <li key={l.id} className="flex items-center gap-2">
              <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
              <span className="min-w-0 flex-1 break-words">{l.name || 'Nhãn không tên'}</span>
              <span className="tabular-nums text-slate-500 dark:text-slate-400">{l.cards} thẻ</span>
            </li>
          ))}
        </ul>
      </>
    );
  }
  if (data.kind === 'CUSTOM_FIELDS') {
    return (
      <>
        <p className="text-xs">Tổng: {data.total} trường tùy chỉnh</p>
        <ul className="space-y-1.5 text-xs">
          {data.rows.map((f) => (
            <li key={f.id}>
              <span className="font-medium">{f.name}</span> <span className="text-slate-500 dark:text-slate-400">· {FIELD_TYPE[f.type] ?? f.type}</span>
              {f.options.length > 0 && <span className="block break-words text-slate-600 dark:text-slate-300">{f.options.map((o) => o.value).join(' · ')}</span>}
            </li>
          ))}
        </ul>
      </>
    );
  }
  return null;
}
