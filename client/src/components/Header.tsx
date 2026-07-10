import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMe, useLogout } from "../queries/auth";
import { memberLabel } from "../labels";
import UserAvatar from "./UserAvatar";

// グローバルなトップバー。表示はアプリ名とアカウントのみ。
// アカウント名をクリックするとドロップダウン（設定・ログアウト）が開く。
export default function Header() {
  const { data } = useMe();
  const logout = useLogout();
  const navigate = useNavigate();
  const user = data?.user;

  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 外側クリック / Esc で閉じる
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const onLogout = () => {
    setOpen(false);
    logout.mutate(undefined, { onSuccess: () => navigate("/login") });
  };

  return (
    <header className="site-header">
      <Link className="brand" to="/">
        📋 タスク管理
      </Link>

      {user && (
        <div className="account" ref={menuRef}>
          <button
            type="button"
            className="account-btn"
            onClick={() => setOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={open}
          >
            <UserAvatar user={user} size={28} />
            <span className="account-name">{memberLabel(user)}</span>
            <span className="account-caret">▾</span>
          </button>

          {open && (
            <div className="account-menu" role="menu">
              <div className="account-menu-head">
                <div className="account-menu-name">{user.name || "（名前未設定）"}</div>
                <div className="account-menu-email muted">@{user.username}</div>
              </div>
              <Link
                to="/account"
                className="account-menu-item"
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                ⚙️ ユーザー設定
              </Link>
              <button
                type="button"
                className="account-menu-item danger"
                role="menuitem"
                onClick={onLogout}
                disabled={logout.isPending}
              >
                ⏻ ログアウト
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
