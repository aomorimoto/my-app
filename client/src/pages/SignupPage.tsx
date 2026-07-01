import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useSignup, useMe } from "../queries/auth";

export default function SignupPage() {
  const meQ = useMe();
  const signup = useSignup();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (meQ.data?.user) return <Navigate to="/tasks" replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    signup.mutate(
      { email, password, name: name || undefined },
      {
        onSuccess: () => navigate("/tasks"),
        onError: (err) => setError(err.message || "登録に失敗しました。"),
      }
    );
  };

  return (
    <main className="container">
      <div className="auth-card card">
        <h1>新規登録</h1>
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
            お名前（任意）
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label>
            パスワード（8文字以上）
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              required
            />
          </label>
          <button type="submit" className="btn-primary" disabled={signup.isPending}>
            登録する
          </button>
        </form>
        <p className="muted">
          すでにアカウントをお持ちの方は <Link to="/login">ログイン</Link>
        </p>
      </div>
    </main>
  );
}
