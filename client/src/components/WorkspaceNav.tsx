import { NavLink } from "react-router-dom";
import { useMe } from "../queries/auth";

// ワークスペース内ページ（タスク/カレンダー/タグ/エージェント/メンバー）共通のサブナビ。
// トップバーは最小構成のため、ワークスペース内の画面遷移はここで行う。
const TABS = [
  { to: "/tasks", label: "タスク" },
  { to: "/calendar", label: "カレンダー" },
  { to: "/tags", label: "タグ" },
  { to: "/agents", label: "エージェント" },
  { to: "/workspaces", label: "メンバー" },
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
