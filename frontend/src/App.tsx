import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import BoardLayout from './layouts/BoardLayout';
import MainLayout from './layouts/MainLayout';
import BoardPage from './pages/BoardPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import PlaceholderPage from './pages/PlaceholderPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ProjectsPage from './pages/ProjectsPage';
import ProjectTaskListPage from './pages/ProjectTaskListPage';
import RegisterPage from './pages/RegisterPage';
import TaskDetailPage from './pages/TaskDetailPage';
import TeamDetailPage from './pages/TeamDetailPage';
import TeamsPage from './pages/TeamsPage';
import ProtectedRoute from './routes/ProtectedRoute';

// Duong dan /kanban cu -> chuyen sang /board moi
function KanbanRedirect() {
  const { projectId } = useParams<{ projectId: string }>();
  return <Navigate to={`/projects/${projectId}/board`} replace />;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<MainLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route
            path="/my-tasks"
            element={<PlaceholderPage title="Công việc của tôi" />}
          />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/teams/:teamId" element={<TeamDetailPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
          <Route
            path="/projects/:projectId/kanban"
            element={<KanbanRedirect />}
          />
          <Route
            path="/projects/:projectId/tasks"
            element={<ProjectTaskListPage />}
          />
          <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
        </Route>

        <Route element={<BoardLayout />}>
          <Route path="/projects/:projectId/board" element={<BoardPage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
