import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useLogin, useMe } from "../queries/auth";

export default function LoginPage() {
  const meQ = useMe();
  const login = useLogin();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // すでにログイン済みならタスク一覧へ
  if (meQ.data?.user) return <Navigate to="/tasks" replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    login.mutate(
      { email, password },
      {
        onSuccess: () => navigate("/tasks"),
        onError: (err) => setError(err.message || "ログインに失敗しました。"),
      }
    );
  };

  return (
    <main className="container">
      <div className="auth-card card">
        <h1>ログイン</h1>
        {error && <p className="error">{error}</p>}
        <form className="form" onSubmit={onSubmit}>
          <label>
            メールアドレス
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </label>
          <label>
            パスワード
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <button type="submit" className="btn-primary" disabled={login.isPending}>
            ログイン
          </button>
        </form>
        <p className="muted">
          アカウントが無い方は <Link to="/signup">新規登録</Link>
        </p>
      </div>
    </main>
  );
}
