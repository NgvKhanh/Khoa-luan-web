import { Outlet } from 'react-router-dom';
import EmailVerifyBanner from '../components/EmailVerifyBanner';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

export default function MainLayout() {
  return (
    <div className="flex h-screen flex-col bg-white dark:bg-slate-900">
      <Header />
      <EmailVerifyBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto bg-[var(--app-bg)]">
          <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
