import DashboardPanel from "../components/DashboardPanel";

// ワークスペース画面のダッシュボードタブ。アクティブなWS単位のサマリを表示する。
export default function DashboardPage() {
  return (
    <>
      <h1>ダッシュボード</h1>
      <DashboardPanel scope="workspace" />
    </>
  );
}
