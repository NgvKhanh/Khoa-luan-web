import { Outlet, useLocation } from 'react-router-dom';
import EmailVerifyBanner from '../components/EmailVerifyBanner';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

export default function MainLayout() {
  const { pathname } = useLocation();
  return (
    <div className="flex h-screen flex-col bg-white dark:bg-slate-900">
      <Header />
      <EmailVerifyBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto bg-[var(--app-bg)]">
          {/* key theo duong dan: doi trang thi noi dung mo dan vao (chi doi do mo) */}
          <div key={pathname} className="tf-page-in mx-auto w-full max-w-5xl p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
