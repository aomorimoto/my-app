import { NavLink, useParams } from "react-router-dom";
import { useMe } from "../queries/auth";
import { useTask } from "../queries/tasks";
import WorkspaceIcon from "./WorkspaceIcon";

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

  // タスク詳細（/tasks/:id）にいるときは、祖先チェーン＋自分をパンくずとして併記する。
  // useParams は WorkspaceNav が /tasks/:id の祖先レイアウトでも現在のパラメータを返す。
  const { id } = useParams();
  const taskQ = useTask(Number(id)); // id が無い/非数値なら内部で無効化される
  const task = taskQ.data?.task;
  const trail = task ? [...(task.ancestors ?? []), { id: task.id, title: task.title }] : [];

  return (
    <div className="ws-nav">
      <div className="ws-nav-head">
        <NavLink to="/" className="ws-nav-home" title="ホームへ戻る">
          ← ホーム
        </NavLink>
        {active && (
          <span className="ws-nav-title">
            <WorkspaceIcon workspace={active} size={20} />
            {active.name}
          </span>
        )}
        {trail.map((t, i) => (
          <span key={t.id} className="ws-nav-crumb">
            <span className="ws-nav-sep" aria-hidden>
              ›
            </span>
            {i === trail.length - 1 ? (
              <span className="ws-nav-crumb-current">{t.title}</span>
            ) : (
              <NavLink to={`/tasks/${t.id}`} className="ws-nav-crumb-link">
                {t.title}
              </NavLink>
            )}
          </span>
        ))}
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
