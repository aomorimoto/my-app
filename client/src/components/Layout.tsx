import { Outlet } from "react-router-dom";
import Header from "./Header";
import ThemeVars from "./ThemeVars";

// 認証必須ページの共通レイアウト（ヘッダー + 本文）
export default function Layout() {
  return (
    <>
      {/* ユーザーの色設定を CSS 変数に適用（描画なしの副作用コンポーネント） */}
      <ThemeVars />
      <Header />
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
