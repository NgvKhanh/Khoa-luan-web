import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../Logo';
import AuthShowcase from './AuthShowcase';

// Shared brand colors keep authentication consistent with the public landing.
export const authFieldClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 transition-colors focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/20';

interface Props {
  title: string;
  subtitle: string;
  children: ReactNode;
  // Dong chan the (vi du: "Chua co tai khoan? Dang ky")
  footer: ReactNode;
}

// Trang Dang nhap / Dang ky: nen xanh thuong hieu. Duoi 1024px chi co the form can giua;
// tu 1024px chia 2 cot: form ben trai, gioi thieu san pham (du lieu demo) ben phai.
export default function AuthShell({ title, subtitle, children, footer }: Props) {
  return (
    <div
      className="relative min-h-screen overflow-hidden lg:grid lg:grid-cols-2"
      style={{ background: 'var(--brand-gradient)', fontFamily: 'var(--brand-font)' }}
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

      <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-6 flex justify-center text-white">
            <Logo
              variant="white"
              markClassName="h-8 w-8"
              textClassName="text-xl font-bold tracking-tight"
            />
          </Link>

          <div className="rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
            <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>

            <div className="mt-6">{children}</div>
          </div>

          <p className="mt-5 text-center text-sm text-white/80">{footer}</p>
          <p className="mt-8 text-center text-xs text-white/85">© 2026 TaskFlow — Đồ án tốt nghiệp</p>
        </div>
      </div>

      <div className="relative">
        <AuthShowcase />
      </div>
    </div>
  );
}
