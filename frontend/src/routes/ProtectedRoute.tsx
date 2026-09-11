import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BoardsProvider } from '../context/BoardsContext';
import { WorkspacesProvider } from '../context/WorkspacesContext';

/** Chi cho vao ben trong neu da dang nhap, con khong thi dua ve trang dang nhap. */
export default function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Dang tai...
      </div>
    );
  }

  if (!user) {
    // Link toi 1 bang cu the -> thu dua sang ban xem CONG KHAI (khong ep dang
    // nhap). Neu bang do khong phai PUBLIC, trang do se tu hien loi + nut
    // dang nhap. Cac duong dan khac van ve /login nhu cu.
    const publicBoardMatch = /^\/boards\/([^/]+)\/?$/.exec(location.pathname);
    if (publicBoardMatch) {
      return <Navigate to={`/public/boards/${publicBoardMatch[1]}`} replace />;
    }
    // Nho lai trang dang muon vao -> dang nhap xong quay lai dung cho
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: location.pathname + location.search }}
      />
    );
  }

  return (
    <WorkspacesProvider>
      <BoardsProvider>
        <Outlet />
      </BoardsProvider>
    </WorkspacesProvider>
  );
}
