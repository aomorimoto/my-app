import { useMe } from "../queries/auth";
import DashboardPanel from "../components/DashboardPanel";

// ワークスペース画面のダッシュボードタブ。アクティブなWS単位のサマリを表示する。
export default function DashboardPage() {
  const meQ = useMe();
  const active = meQ.data?.activeWorkspace;

  return (
    <>
      <h1>ダッシュボード</h1>
      {active && (
        <p className="muted">
          表示中: <strong>{active.name}</strong>
        </p>
      )}
      <DashboardPanel scope="workspace" />
    </>
  );
}
