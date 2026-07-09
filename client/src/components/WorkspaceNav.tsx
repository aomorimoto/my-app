import { NavLink } from "react-router-dom";
import { useMe } from "../queries/auth";

// ワークスペース内ページ（ダッシュボード/カレンダー/タスク/設定）共通のサブナビ。
// トップバーは最小構成のため、ワークスペース内の画面遷移はここで行う。
// タグ/エージェント/メンバーの管理は「設定」タブに集約している。
const TABS = [
  { to: "/dashboard", label: "ダッシュボード" },
  { to: "/calendar", label: "カレンダー" },
  { to: "/tasks", label: "タスク" },
  { to: "/settings", label: "設定" },
];

export default function WorkspaceNav() {
  const { data } = useMe();
  const active = data?.activeWorkspace;

  return (
    <div className="ws-nav">
      <div className="ws-nav-head">
        <NavLink to="/" className="ws-nav-home" title="ホームへ戻る">
          ← ホーム
        </NavLink>
        {active && <span className="ws-nav-title">🗂 {active.name}</span>}
      </div>
      <nav className="ws-nav-tabs">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) => `ws-tab${isActive ? " active" : ""}`}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
