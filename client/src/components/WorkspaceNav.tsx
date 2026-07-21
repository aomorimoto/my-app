import { NavLink, useParams } from "react-router-dom";
import { useTask } from "../queries/tasks";
import { useWorkspace } from "../lib/workspaceContext";
import WorkspaceIcon from "./WorkspaceIcon";

// ワークスペース内ページ（ダッシュボード/カレンダー/タスク/設定）共通のサブナビ。
// トップバーは最小構成のため、ワークスペース内の画面遷移はここで行う。
// タグ/エージェント/メンバーの管理は「設定」タブに集約している。
const TABS = [
  { path: "dashboard", label: "ダッシュボード" },
  { path: "calendar", label: "カレンダー" },
  { path: "tasks", label: "タスク" },
  { path: "settings", label: "設定" },
];

export default function WorkspaceNav() {
  const { wsPublicId, workspace } = useWorkspace();
  const base = `/w/${wsPublicId}`;

  // タスク詳細（/w/:ws/tasks/:number）にいるときは、祖先チェーン＋自分をパンくずとして併記する。
  // useParams は WorkspaceNav が /tasks/:number の祖先レイアウトでも現在のパラメータを返す。
  const { number } = useParams();
  const taskQ = useTask(Number(number)); // number が無い/非数値なら内部で無効化される
  const task = taskQ.data?.task;
  const trail = task
    ? [...(task.ancestors ?? []), { number: task.number, title: task.title }]
    : [];

  return (
    <div className="ws-nav">
      <div className="ws-nav-head">
        <NavLink to="/" className="ws-nav-home" title="ホームへ戻る">
          ← ホーム
        </NavLink>
        <span className="ws-nav-title">
          <WorkspaceIcon workspace={workspace} size={20} />
          {workspace.name}
        </span>
        {trail.map((t, i) => (
          <span key={t.number} className="ws-nav-crumb">
            <span className="ws-nav-sep" aria-hidden>
              ›
            </span>
            {i === trail.length - 1 ? (
              <span className="ws-nav-crumb-current">{t.title}</span>
            ) : (
              <NavLink to={`${base}/tasks/${t.number}`} className="ws-nav-crumb-link">
                {t.title}
              </NavLink>
            )}
          </span>
        ))}
      </div>
      <nav className="ws-nav-tabs">
        {TABS.map((t) => (
          <NavLink
            key={t.path}
            to={`${base}/${t.path}`}
            className={({ isActive }) => `ws-tab${isActive ? " active" : ""}`}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
