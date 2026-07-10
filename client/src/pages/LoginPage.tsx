import { useState, useEffect, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { useLogin, useMe } from "../queries/auth";

// ログイン後の復帰先（returnTo）を検証する。オープンリダイレクト対策として、
// 同一オリジンの相対パスで、かつ OAuth 認可エンドポイント（/authorize）のみを許可する。
// /authorize はサーバ側ルート（mcpAuthRouter）なので、react-router ではなく全ページ遷移で戻す。
export function safeReturnTo(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null; // 相対パスのみ（"//host" を弾く）
  if (raw !== "/authorize" && !raw.startsWith("/authorize?")) return null; // 認可エンドポイントのみ
  return raw;
}

export default function LoginPage() {
  const meQ = useMe();
  const login = useLogin();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnTo = safeReturnTo(searchParams.get("returnTo"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // すでにログイン済みで OAuth 認可への復帰要求があれば、サーバ側 /authorize へ全ページ遷移する。
  useEffect(() => {
    if (meQ.data?.user && returnTo) {
      window.location.assign(returnTo);
    }
  }, [meQ.data?.user, returnTo]);

  // すでにログイン済み: 復帰先があれば上の effect が遷移する（その間は描画しない）。無ければメイン画面へ。
  if (meQ.data?.user) return returnTo ? null : <Navigate to="/" replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    login.mutate(
      { username, password },
      {
        onSuccess: () => {
          // OAuth 認可フローの途中なら /authorize へ全ページ遷移、通常はメイン画面へ。
          if (returnTo) window.location.assign(returnTo);
          else navigate("/");
        },
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
            ユーザーID
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
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
