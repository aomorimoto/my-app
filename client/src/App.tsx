import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import WorkspaceLayout from "./components/WorkspaceLayout";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import HomePage from "./pages/HomePage";
import CalendarPage from "./pages/CalendarPage";
import TasksPage from "./pages/TasksPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import TagsPage from "./pages/TagsPage";
import AgentsPage from "./pages/AgentsPage";
import WorkspacesPage from "./pages/WorkspacesPage";

export default function App() {
  return (
    <Routes>
      {/* 公開ページ */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* 認証必須ページ（共通レイアウト配下） */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* メイン画面: ダッシュボード + ワークスペース一覧 */}
        <Route path="/" element={<HomePage />} />

        {/* ワークスペース内ページ（サブナビ付き） */}
        <Route element={<WorkspaceLayout />}>
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/tags" element={<TagsPage />} />
          <Route path="/agents" element={<AgentsPage />} />
          <Route path="/workspaces" element={<WorkspacesPage />} />
        </Route>
      </Route>

      {/* リダイレクト（既定の入口はメイン画面） */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
