import { Navigate, Route, Routes } from 'react-router-dom';
import BoardViewLayout from './layouts/BoardViewLayout';
import MainLayout from './layouts/MainLayout';
import BoardPage from './pages/BoardPage';
import CalendarPage from './pages/CalendarPage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import HomePage from './pages/HomePage';
import JoinBoardPage from './pages/JoinBoardPage';
import LoginPage from './pages/LoginPage';
import MyActivityPage from './pages/MyActivityPage';
import MyCardsPage from './pages/MyCardsPage';
import ProfilePage from './pages/ProfilePage';
import RegisterPage from './pages/RegisterPage';
import ProtectedRoute from './routes/ProtectedRoute';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/my-cards" element={<MyCardsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/settings/profile" element={<ProfilePage />} />
          <Route path="/settings/password" element={<ChangePasswordPage />} />
          <Route path="/activity" element={<MyActivityPage />} />
        </Route>

        <Route path="/join/:token" element={<JoinBoardPage />} />

        <Route element={<BoardViewLayout />}>
          <Route path="/boards/:boardId" element={<BoardPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
