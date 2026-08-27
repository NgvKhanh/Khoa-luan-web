import { Outlet } from 'react-router-dom';
import Header from '../components/Header';

// Layout danh rieng cho trang Board: noi dung trai het chieu ngang, tu quan ly cuon.
export default function BoardLayout() {
  return (
    <div className="flex h-screen flex-col">
      <Header />
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
