import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useMe, useLogout } from "../queries/auth";
import UserAvatar from "../components/UserAvatar";
import { memberLabel } from "../labels";

// MCP（OAuth 2.1）認可の同意/アカウント確認画面。
// サーバの /authorize は、ログイン済みでも consent=granted が付くまでコードを発行せず、
// この画面（/oauth/consent?<元の認可パラメータ>）へ一旦リダイレクトしてくる。
// ここで「どのアカウントで接続するか」を確認し、承認するか別アカウントに切り替える。
export default function OAuthConsentPage() {
  const meQ = useMe();
  const logout = useLogout();
  const location = useLocation();
  const [busy, setBusy] = useState(false);

  // 元の認可パラメータ（"?client_id=...&redirect_uri=..."）。これを付けて /authorize に戻す。
  const search = location.search;
  // 承認: 同じ認可 URL に consent=granted を付けてサーバ /authorize へ全ページ遷移（コード発行）。
  const approveUrl = `/authorize${search}&consent=granted`;
  // 認可 URL（consent フラグ無し）。アカウント切替後のログイン復帰先に使う。
  const authorizeUrl = `/authorize${search}`;

  // 未ログイン（直接アクセス等）ならログインへ。ログイン後は認可フローに復帰する。
  useEffect(() => {
    if (busy) return;
    if (!meQ.isLoading && meQ.data && !meQ.data.user) {
      window.location.assign("/login?returnTo=" + encodeURIComponent(authorizeUrl));
    }
  }, [meQ.isLoading, meQ.data, busy, authorizeUrl]);

  // パラメータが無い直接アクセスは不正。
  if (!search) {
    return (
      <main className="container">
        <div className="auth-card card">
          <h1>接続の確認</h1>
          <p className="error">認可リクエストの情報がありません。接続を最初からやり直してください。</p>
        </div>
      </main>
    );
  }

  const user = meQ.data?.user;
  if (meQ.isLoading || !user) {
    // 読み込み中、または未ログイン（上の effect が遷移するまでの間）は何も描画しない。
    return null;
  }

  // 承認 → サーバ /authorize（consent=granted）へ全ページ遷移。以降はクライアントへリダイレクトされる。
  const onApprove = () => {
    setBusy(true);
    window.location.assign(approveUrl);
  };

  // 別アカウントで接続 → ログアウトしてからログインへ。ログイン後に認可フローへ復帰する。
  const onSwitch = () => {
    setBusy(true);
    logout.mutate(undefined, {
      onSuccess: () => {
        window.location.assign("/login?returnTo=" + encodeURIComponent(authorizeUrl));
      },
      onError: () => setBusy(false),
    });
  };

  return (
    <main className="container">
      <div className="auth-card card">
        <h1>接続の確認</h1>
        <p className="muted">
          外部アプリ（Claude など）が、以下のアカウントとして taskapp に接続しようとしています。
        </p>

        <div className="consent-account">
          <UserAvatar user={user} size={40} />
          <div>
            <div className="consent-name">{memberLabel(user)}</div>
            <div className="muted">@{user.username}</div>
          </div>
        </div>

        <p className="muted">
          接続すると、このアカウントが所属するワークスペースのタスク等を、あなたの権限の範囲で
          操作できるようになります。
        </p>

        <div className="consent-actions">
          <button type="button" className="btn-primary" onClick={onApprove} disabled={busy}>
            このアカウントで接続
          </button>
          <button type="button" className="link-btn" onClick={onSwitch} disabled={busy}>
            別のアカウントで接続
          </button>
        </div>
      </div>
    </main>
  );
}
