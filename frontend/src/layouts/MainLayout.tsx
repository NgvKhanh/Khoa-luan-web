import { Outlet } from 'react-router-dom';
import Header from '../components/Header';

export default function MainLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-5xl p-4 sm:p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
