import { Outlet } from 'react-router-dom';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';

export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Header />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 bg-[var(--app-bg)]">
          <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
