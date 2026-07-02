import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import TasksPage from "./pages/TasksPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import CategoriesPage from "./pages/CategoriesPage";
import TagsPage from "./pages/TagsPage";
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
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/tasks/:id" element={<TaskDetailPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/tags" element={<TagsPage />} />
        <Route path="/workspaces" element={<WorkspacesPage />} />
      </Route>

      {/* リダイレクト */}
      <Route path="/" element={<Navigate to="/tasks" replace />} />
      <Route path="*" element={<Navigate to="/tasks" replace />} />
    </Routes>
  );
}
