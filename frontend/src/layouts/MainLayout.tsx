import { Outlet } from 'react-router-dom';
import Header from '../components/Header';

// Layout chung cho cac trang thuong (co le hai ben, gioi han be rong).
// Rieng trang Board dung BoardLayout de trai het man hinh.
export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
