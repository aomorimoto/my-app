import { Outlet } from "react-router-dom";
import WorkspaceNav from "./WorkspaceNav";

// ワークスペース内ページ共通レイアウト（サブナビ + 本文）。
export default function WorkspaceLayout() {
  return (
    <>
      <WorkspaceNav />
      <Outlet />
    </>
  );
}
