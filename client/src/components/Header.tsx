import { Link, useNavigate } from "react-router-dom";
import { useMe, useLogout } from "../queries/auth";
import { useWorkspaces, useActivateWorkspace } from "../queries/workspaces";

export default function Header() {
  const { data } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const wsQ = useWorkspaces();
  const activate = useActivateWorkspace();

  const user = data?.user;
  const activeId = data?.activeWorkspace?.id;
  const workspaces = wsQ.data?.workspaces ?? [];

  const onLogout = () => {
    logout.mutate(undefined, { onSuccess: () => navigate("/login") });
  };

  const onSwitch = (value: string) => {
    const id = Number(value);
    if (id && id !== activeId) activate.mutate(id);
  };

  return (
    <header className="site-header">
      <Link className="brand" to="/dashboard">
        📋 タスク管理
      </Link>
      <nav>
        <Link to="/dashboard">ダッシュボード</Link>
        <Link to="/tasks">タスク</Link>
        <Link to="/categories">カテゴリ</Link>
        <Link to="/tags">タグ</Link>
        <Link to="/workspaces">ワークスペース</Link>
        {workspaces.length > 0 && (
          <select
            className="ws-switcher"
            value={activeId ?? ""}
            onChange={(e) => onSwitch(e.target.value)}
            disabled={activate.isPending}
            title="ワークスペースを切り替え"
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                🗂 {w.name}
              </option>
            ))}
          </select>
        )}
        {user && <span className="user">{user.name || user.email}</span>}
        <button type="button" className="link-btn" onClick={onLogout} disabled={logout.isPending}>
          ログアウト
        </button>
      </nav>
    </header>
  );
}
