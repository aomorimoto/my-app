import { Navigate, Outlet, useParams } from "react-router-dom";
import { useWorkspaces } from "../queries/workspaces";
import { WorkspaceContext } from "../lib/workspaceContext";
import WorkspaceNav from "./WorkspaceNav";

// ワークスペース内ページ共通レイアウト（URL 駆動）。
// URL の :wsPublicId を所属一覧と突き合わせ、対象WSを解決してから配下を描画する。
//   - 一覧読み込み中: ローディング表示。
//   - 未所属/未知の publicId: メイン画面へ戻す（サーバも 403/404 を返す）。
// 解決したワークスペースは Context で配下（サブナビ・各ページ・クエリフック）へ渡す。
export default function WorkspaceLayout() {
  const { wsPublicId } = useParams();
  const wsQ = useWorkspaces();

  if (wsQ.isLoading) return <p className="muted">読み込み中…</p>;

  const workspace = wsQ.data?.workspaces.find((w) => w.publicId === wsPublicId);
  if (!workspace) return <Navigate to="/" replace />;

  return (
    <WorkspaceContext.Provider value={{ wsPublicId: wsPublicId!, workspace }}>
      <WorkspaceNav />
      <Outlet />
    </WorkspaceContext.Provider>
  );
}
