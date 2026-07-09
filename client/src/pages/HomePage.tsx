import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  useWorkspaces,
  useActivateWorkspace,
  useReorderWorkspaces,
  useCreateWorkspace,
} from "../queries/workspaces";
import { useHomeTasks } from "../queries/home";
import { useOpenTask } from "../hooks/useOpenTask";
import { useDragList } from "../hooks/useDragList";
import { ROLE_LABEL } from "../labels";
import DashboardPanel from "../components/DashboardPanel";
import CalendarGrid from "../components/CalendarGrid";
import type { Workspace } from "../types";

// D&D 同期用の安定した空配列（参照固定で useDragList の再同期ループを防ぐ）。
const EMPTY_WORKSPACES: Workspace[] = [];

// メイン画面: 左は集約ビュー（ダッシュボード / カレンダーを切替。所属する全WSを横断）、
// 右はワークスペース一覧（並べ替え可能）。
export default function HomePage() {
  const navigate = useNavigate();
  const wsQ = useWorkspaces();
  const activate = useActivateWorkspace();
  const reorder = useReorderWorkspaces();
  const createWs = useCreateWorkspace();

  const workspaces = wsQ.data?.workspaces ?? EMPTY_WORKSPACES;

  // 左ペインの表示ビュー（ダッシュボード / カレンダー）
  const [view, setView] = useState<"dashboard" | "calendar">("dashboard");

  const [wsName, setWsName] = useState("");
  const [wsError, setWsError] = useState<string | null>(null);

  // クリックでそのワークスペースを開く（アクティブ化 → タスク画面へ）。
  const openWs = (id: number) => {
    activate.mutate(id, { onSuccess: () => navigate("/tasks") });
  };

  // 並べ替えはドラッグ&ドロップ。新しい並び順の id 配列をサーバへ保存する。
  const drag = useDragList(workspaces, (ids) => reorder.mutate(ids));

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
        <div className="home-toolbar">
          <div className="seg" role="tablist" aria-label="表示ビュー">
            <button
              type="button"
              role="tab"
              aria-selected={view === "dashboard"}
              className={`seg-btn ${view === "dashboard" ? "active" : ""}`}
              onClick={() => setView("dashboard")}
            >
              ダッシュボード
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === "calendar"}
              className={`seg-btn ${view === "calendar" ? "active" : ""}`}
              onClick={() => setView("calendar")}
            >
              カレンダー
            </button>
          </div>
        </div>

        {view === "dashboard" ? <DashboardPanel scope="home" /> : <HomeCalendar />}
      </section>

      <aside className="home-ws">
        <h1>ワークスペース</h1>
        {wsQ.isLoading ? (
          <p className="muted">読み込み中…</p>
        ) : (
          <>
            {workspaces.length > 1 && (
              <p className="muted reorder-hint">⠿ ドラッグで並べ替えできます。</p>
            )}
            <ul className="ws-list">
              {drag.items.map((w, i) => (
                <li
                  key={w.id}
                  className={`ws-card ${drag.overIndex === i ? "drag-over" : ""}`}
                  draggable
                  onDragStart={drag.onDragStart(i)}
                  onDragOver={drag.onDragOver(i)}
                  onDrop={drag.onDrop(i)}
                  onDragEnd={drag.onDragEnd}
                >
                  <span className="ws-drag" title="ドラッグして並べ替え" aria-hidden>
                    ⠿
                  </span>
                  <button type="button" className="ws-open" onClick={() => openWs(w.id)}>
                    <span className="ws-name">🗂 {w.name}</span>
                    <span className="ws-meta">
                      <span className="badge role">{ROLE_LABEL[w.role]}</span>
                      <span className="muted">👥 {w.memberCount}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
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

// メイン画面の集約カレンダー（全ワークスペース横断）。チップは所属WSを併記し、
// クリックで（必要ならWSを切り替えて）タスク詳細を開く。
function HomeCalendar() {
  const openTask = useOpenTask();
  const { data, isLoading, isError } = useHomeTasks();
  const tasks = data?.tasks ?? [];

  if (isLoading) return <p className="muted">読み込み中…</p>;
  if (isError) return <p className="error">タスクの取得に失敗しました。</p>;
  return <CalendarGrid tasks={tasks} onOpenTask={openTask} showWorkspace />;
}
