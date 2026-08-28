import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BoardsProvider } from '../context/BoardsContext';

/** Chi cho vao ben trong neu da dang nhap, con khong thi dua ve trang dang nhap. */
export default function ProtectedRoute() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Dang tai...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <BoardsProvider>
      <Outlet />
    </BoardsProvider>
  );
}
