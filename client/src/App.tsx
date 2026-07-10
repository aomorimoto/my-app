import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import WorkspaceLayout from "./components/WorkspaceLayout";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import OAuthConsentPage from "./pages/OAuthConsentPage";
import HomePage from "./pages/HomePage";
import AccountPage from "./pages/AccountPage";
import DashboardPage from "./pages/DashboardPage";
import CalendarPage from "./pages/CalendarPage";
import TasksPage from "./pages/TasksPage";
import TaskDetailPage from "./pages/TaskDetailPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <Routes>
      {/* 公開ページ */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* MCP（OAuth）認可の同意/アカウント確認画面。サーバ /authorize から遷移してくる。 */}
      <Route path="/oauth/consent" element={<OAuthConsentPage />} />

      {/* 認証必須ページ（共通レイアウト配下） */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* メイン画面: 集約ビュー（ダッシュボード/カレンダー） + ワークスペース一覧 */}
        <Route path="/" element={<HomePage />} />

        {/* ユーザー設定（ワークスペースに依存しない全体設定: 名前・アバター・表示色） */}
        <Route path="/account" element={<AccountPage />} />

        {/* ワークスペース内ページ（サブナビ付き: ダッシュボード/カレンダー/タスク/設定） */}
        <Route element={<WorkspaceLayout />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/tasks/:id" element={<TaskDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>

      {/* リダイレクト（既定の入口はメイン画面） */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
