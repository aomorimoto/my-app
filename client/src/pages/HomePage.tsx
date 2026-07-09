import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMe } from "../queries/auth";
import {
  useWorkspaces,
  useActivateWorkspace,
  useReorderWorkspaces,
  useCreateWorkspace,
} from "../queries/workspaces";
import { ROLE_LABEL } from "../labels";
import DashboardPanel from "../components/DashboardPanel";
import type { Workspace } from "../types";

// メイン画面: 左にダッシュボード、右にワークスペース一覧（並べ替え可能）。
export default function HomePage() {
  const navigate = useNavigate();
  const meQ = useMe();
  const wsQ = useWorkspaces();
  const activate = useActivateWorkspace();
  const reorder = useReorderWorkspaces();
  const createWs = useCreateWorkspace();

  const activeId = meQ.data?.activeWorkspace?.id;
  const workspaces = wsQ.data?.workspaces ?? [];

  const [wsName, setWsName] = useState("");
  const [wsError, setWsError] = useState<string | null>(null);

  // クリックでそのワークスペースを開く（アクティブ化 → タスク画面へ）。
  const openWs = (id: number) => {
    if (id === activeId) {
      navigate("/tasks");
      return;
    }
    activate.mutate(id, { onSuccess: () => navigate("/tasks") });
  };

  // 並べ替え（↑↓）。現在の並びから id 配列を作り、入れ替えてサーバへ保存する。
  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= workspaces.length) return;
    const ids = workspaces.map((w) => w.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    reorder.mutate(ids);
  };

  const onCreateWs = (e: FormEvent) => {
    e.preventDefault();
    setWsError(null);
    createWs.mutate(
      { name: wsName },
      {
        onSuccess: (data: { workspace: Workspace }) => {
          setWsName("");
          // 作成したワークスペースを開く
          activate.mutate(data.workspace.id, { onSuccess: () => navigate("/tasks") });
        },
        onError: (err) => setWsError(err.message || "作成に失敗しました。"),
      }
    );
  };

  return (
    <div className="home">
      <section className="home-dash">
        <h1>ダッシュボード</h1>
        {meQ.data?.activeWorkspace && (
          <p className="muted home-active-ws">
            表示中: <strong>{meQ.data.activeWorkspace.name}</strong>
          </p>
        )}
        <DashboardPanel />
      </section>

      <aside className="home-ws">
        <h1>ワークスペース</h1>
        {wsQ.isLoading ? (
          <p className="muted">読み込み中…</p>
        ) : (
          <ul className="ws-list">
            {workspaces.map((w, i) => (
              <li key={w.id} className={`ws-card ${w.id === activeId ? "active" : ""}`}>
                <div className="ws-reorder">
                  <button
                    type="button"
                    className="ws-arrow"
                    title="上へ"
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || reorder.isPending}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="ws-arrow"
                    title="下へ"
                    onClick={() => move(i, 1)}
                    disabled={i === workspaces.length - 1 || reorder.isPending}
                  >
                    ▼
                  </button>
                </div>
                <button type="button" className="ws-open" onClick={() => openWs(w.id)}>
                  <span className="ws-name">🗂 {w.name}</span>
                  <span className="ws-meta">
                    <span className="badge role">{ROLE_LABEL[w.role]}</span>
                    <span className="muted">👥 {w.memberCount}</span>
                    {w.id === activeId && <span className="badge ws-active-badge">表示中</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <form className="form card ws-create-form" onSubmit={onCreateWs}>
          <h2>新しいワークスペース</h2>
          {wsError && <p className="error">{wsError}</p>}
          <label className="grow">
            名前
            <input
              type="text"
              value={wsName}
              onChange={(e) => setWsName(e.target.value)}
              placeholder="チーム名・プロジェクト名"
              required
            />
          </label>
          <button
            type="submit"
            className="btn-primary"
            disabled={createWs.isPending || activate.isPending}
          >
            作成して開く
          </button>
        </form>
      </aside>
    </div>
  );
}
