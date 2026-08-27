import { Link, useNavigate } from 'react-router-dom';

// Trang hien khi duong dan khong khop route nao (loi 404).
export default function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--app-bg)] px-4 text-center">
      <Link
        to="/"
        className="mb-8 flex items-center gap-2 font-bold tracking-tight text-[#1558bc]"
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#1558bc] text-white">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
            <rect x="3" y="3" width="7" height="18" rx="1" />
            <rect x="14" y="3" width="7" height="11" rx="1" />
          </svg>
        </span>
        TaskFlow
      </Link>

      <p className="text-7xl font-extrabold tracking-tight text-[#1558bc] sm:text-8xl">
        404
      </p>
      <h1 className="mt-4 text-xl font-semibold text-slate-800">
        Không tìm thấy trang
      </h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        Đường dẫn bạn truy cập không tồn tại hoặc đã được di chuyển. Hãy quay lại
        và thử lại nhé.
      </p>

      <div className="mt-6 flex items-center gap-3">
        <Link
          to="/"
          className="rounded-lg bg-[#1558bc] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#0f4aa8]"
        >
          Về trang chủ
        </Link>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Quay lại trang trước
        </button>
      </div>
    </div>
  );
}
