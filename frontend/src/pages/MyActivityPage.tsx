import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyActivity, type MyActivity } from '../lib/api/auth';
import { statusLabel } from '../lib/cardStatus';
import { SkeletonRegion, SkeletonRows } from '../components/Skeleton';
import { getErrorMessage } from '../lib/errorMessage';

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function text(a: MyActivity): string {
  const d = a.data;
  const card = d.cardTitle ? `"${d.cardTitle}"` : 'thẻ';
  switch (a.type) {
    case 'card.create':
      return `Tạo thẻ mới trong danh sách ${d.listName ?? ''}`;
    case 'card.move':
      return `Chuyển thẻ ${card} từ ${d.fromList} sang ${d.toList}`;
    case 'card.rename':
      return `Đổi tên thẻ thành ${card}`;
    case 'card.done':
      return `Đánh dấu hoàn thành thẻ ${card}`;
    case 'card.undone':
      return `Bỏ đánh dấu hoàn thành thẻ ${card}`;
    case 'card.status':
      return `Chuyển trạng thái thẻ ${card} từ "${statusLabel(d.from)}" sang "${statusLabel(d.to)}"`;
    case 'card.due.set':
      return `Đặt ngày hết hạn cho thẻ ${card}`;
    case 'card.due.clear':
      return `Bỏ ngày hết hạn của thẻ ${card}`;
    case 'comment.create':
      return `Bình luận trên thẻ: ${d.text ?? ''}`;
    case 'member.add':
      return `Thêm ${d.memberName} vào thẻ ${card}`;
    case 'checklist.add':
      return `Thêm việc cần làm "${d.title}"`;
    default:
      return a.type;
  }
}

export default function MyActivityPage() {
  const [items, setItems] = useState<MyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyActivity()
      .then(setItems)
      .catch((err) => setError(getErrorMessage(err, 'Không tải được hoạt động.')))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 text-lg font-semibold text-slate-900 dark:text-slate-100">
        Hoạt động của tôi
      </h1>

      {loading ? (
        <SkeletonRegion label="Đang tải hoạt động…">
          <SkeletonRows rows={6} boxed />
        </SkeletonRegion>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Chưa có hoạt động nào.
        </p>
      ) : (
        <ul className="divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800">
          {items.map((a) => (
            <li key={a.id} className="px-4 py-3 text-sm">
              <p className="text-slate-700 dark:text-slate-200">{text(a)}</p>
              <p className="mt-0.5 text-xs text-slate-400">
                {a.board ? (
                  <Link
                    to={`/boards/${a.board.id}`}
                    className="text-primary-ink hover:underline"
                  >
                    {a.board.name}
                  </Link>
                ) : (
                  'Bảng đã xoá'
                )}
                {' · '}
                {fmt(a.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
