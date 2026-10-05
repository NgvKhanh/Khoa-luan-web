import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import EmailVerifyBanner from '../components/EmailVerifyBanner';
import Header from '../components/Header';
import Sidebar, { MainMobileNav } from '../components/Sidebar';

export default function MainLayout() {
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  // Tổng quan và danh sách bảng cần rộng hơn (cột phụ, lưới 4 cột); các trang còn lại giữ bề rộng đọc gọn
  const wide = pathname === '/home' || pathname === '/boards';
  // Tìm kiếm nâng cao lấp đúng chiều cao vùng nội dung (từ md): bộ lọc đứng yên, chỉ danh sách kết quả cuộn
  const fill = pathname === '/search';
  return (
    <div className="flex h-screen flex-col bg-white dark:bg-slate-900">
      <Header onOpenNav={() => setNavOpen(true)} />
      <MainMobileNav open={navOpen} onClose={() => setNavOpen(false)} />
      <EmailVerifyBanner />
      <div className="flex min-h-0 flex-1">
        <Sidebar />
        <main className="min-w-0 flex-1 overflow-y-auto bg-[var(--app-bg)]">
          {/* key theo duong dan: doi trang thi noi dung mo dan vao (chi doi do mo) */}
          <div
            key={pathname}
            className={`tf-page-in mx-auto w-full p-4 sm:p-6 ${wide ? 'max-w-6xl' : 'max-w-5xl'} ${fill ? 'md:h-full' : ''}`}
          >
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
