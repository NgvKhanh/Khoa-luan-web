import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

// Class dung chung cho o nhap trong cac trang xac thuc (dong bo focus mau xanh app)
export const authFieldClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-[#1558bc] focus:outline-none focus:ring-2 focus:ring-[#1558bc]/20';

function Logo({ className = '' }: { className?: string }) {
  return (
    <span
      className={`flex items-center gap-2 font-bold tracking-tight ${className}`}
    >
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

// Trang Dang nhap / Dang ky: 1 the trang can chinh giua man hinh, nen xanh thuong hieu.
export default function AuthShell({ title, subtitle, children, footer }: Props) {
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10"
      style={{ background: 'linear-gradient(135deg, #1558bc 0%, #0b3f8f 70%)' }}
    >
      {/* Doi sang trang tri mo o goc */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-white/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-white/10 blur-3xl"
      />

      <div className="relative w-full max-w-sm">
        <Link to="/" className="mb-6 flex justify-center text-white">
          <Logo className="text-xl" />
        </Link>

        <div className="rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
          <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>

          <div className="mt-6">{children}</div>
        </div>

        <p className="mt-5 text-center text-sm text-white/80">{footer}</p>
        <p className="mt-8 text-center text-xs text-white/50">
          © 2026 TaskFlow — Đồ án tốt nghiệp
        </p>
      </div>
    </div>
  );
}
