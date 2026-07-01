import { Outlet } from "react-router-dom";
import Header from "./Header";

// 認証必須ページの共通レイアウト（ヘッダー + 本文）
export default function Layout() {
  return (
    <>
      <Header />
      <main className="container">
        <Outlet />
      </main>
    </>
  );
}
