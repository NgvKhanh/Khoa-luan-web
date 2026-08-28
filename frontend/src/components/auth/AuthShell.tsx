import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

// Class dung chung cho o nhap trong cac trang xac thuc (dong bo focus mau xanh app)
export const authFieldClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-[#1558bc] focus:outline-none focus:ring-2 focus:ring-[#1558bc]/20';

function Logo({ className = '' }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 font-bold tracking-tight ${className}`}>
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-white text-[#1558bc]">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
          <rect x="3" y="3" width="7" height="18" rx="1" />
          <rect x="14" y="3" width="7" height="11" rx="1" />
        </svg>
      </span>
      TaskFlow
    </span>
  );
}

interface Props {
  title: string;
  subtitle: string;
  children: ReactNode;
  // Dong chan the (vi du: "Chua co tai khoan? Dang ky")
  footer: ReactNode;
}

// Khung 2 cot cho trang Dang nhap / Dang ky: ben trai gioi thieu, ben phai la form.
export default function AuthShell({ title, subtitle, children, footer }: Props) {
  return (
    <div className="min-h-screen w-full lg:grid lg:grid-cols-[1.05fr_1fr]">
      {/* Cot gioi thieu - chi hien tu man hinh lon */}
      <div
        className="relative hidden overflow-hidden p-12 text-white lg:flex lg:flex-col lg:justify-between"
        style={{
          background: 'linear-gradient(135deg, #1558bc 0%, #0b3f8f 70%)',
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/10 blur-3xl"
        />

        <Link to="/" className="relative">
          <Logo className="text-lg" />
        </Link>

        <div className="relative max-w-md">
          <h2 className="text-3xl font-bold leading-snug">
            Chào mừng đến với TaskFlow.
          </h2>
          <p className="mt-4 text-sm text-white/80">
            Đăng nhập để tiếp tục.
          </p>
        </div>

        <p className="relative text-xs text-white/60">
          © 2026 TaskFlow — Đồ án tốt nghiệp
        </p>
      </div>

      {/* Cot form */}
      <div className="flex min-h-screen items-center justify-center bg-[var(--app-bg)] px-4 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <Link
            to="/"
            className="mb-6 flex justify-center text-[#1558bc] lg:hidden"
          >
            <Logo className="text-lg" />
          </Link>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>

            <div className="mt-6">{children}</div>
          </div>

          <p className="mt-5 text-center text-sm text-slate-500">{footer}</p>
        </div>
      </div>
    </div>
  );
}
