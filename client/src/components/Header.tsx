import { Link, useNavigate } from "react-router-dom";
import { useMe, useLogout } from "../queries/auth";

export default function Header() {
  const { data } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const user = data?.user;

  const onLogout = () => {
    logout.mutate(undefined, { onSuccess: () => navigate("/login") });
  };

  return (
    <header className="site-header">
      <Link className="brand" to="/tasks">
        📋 タスク管理
      </Link>
      <nav>
        <Link to="/tasks">タスク</Link>
        <Link to="/categories">カテゴリ</Link>
        {user && <span className="user">{user.name || user.email}</span>}
        <button type="button" className="link-btn" onClick={onLogout} disabled={logout.isPending}>
          ログアウト
        </button>
      </nav>
    </header>
  );
}
