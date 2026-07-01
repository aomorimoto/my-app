import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useMe } from "../queries/auth";

// 認証必須ページのガード。未ログインなら /login へ。
export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { data, isLoading, isError } = useMe();

  if (isLoading) {
    return (
      <div className="container">
        <p className="muted">読み込み中…</p>
      </div>
    );
  }

  if (isError || !data?.user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
