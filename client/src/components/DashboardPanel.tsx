import { useDashboard } from "../queries/dashboard";
import { useHomeDashboard } from "../queries/home";
import { useOpenTask } from "../hooks/useOpenTask";
import { STATUS_LABEL } from "../labels";
import TaskItem from "./TaskItem";
import HomeTaskItem from "./HomeTaskItem";
import type { Task } from "../types";

// ダッシュボード本体。scope で対象を切り替える。
//   "workspace": アクティブなワークスペース単位（ワークスペース画面のダッシュボードタブ）。
//   "home":      所属する全ワークスペースを横断した集約（メイン画面）。
// home では複数WSにまたがるため、行はクリックで開くだけの読み取り専用（HomeTaskItem）にする。
export default function DashboardPanel({ scope = "workspace" }: { scope?: "workspace" | "home" }) {
  const isHome = scope === "home";
  const workspaceQ = useDashboard({ enabled: !isHome });
  const homeQ = useHomeDashboard({ enabled: isHome });
  const openTask = useOpenTask();

  const { data, isLoading, isError } = isHome ? homeQ : workspaceQ;

  if (isLoading) return <p className="muted">読み込み中…</p>;
  if (isError || !data) return <p className="error">ダッシュボードの取得に失敗しました。</p>;

  const { summary, upcoming, myTasks } = data;

  // 全体の進捗（完了タスク ÷ 全タスク）。トップレベルタスクの完了率。
  const donePct = summary.total > 0 ? Math.round((summary.byStatus.DONE / summary.total) * 100) : 0;

  const stats = [
    { key: "overdue", label: "期限超過", value: summary.overdue, tone: "danger" },
    { key: "dueToday", label: "今日締切", value: summary.dueToday, tone: "warn" },
    { key: "dueThisWeek", label: "今週締切", value: summary.dueThisWeek, tone: "warn" },
    { key: "todo", label: STATUS_LABEL.TODO, value: summary.byStatus.TODO, tone: "" },
    { key: "inprog", label: STATUS_LABEL.IN_PROGRESS, value: summary.byStatus.IN_PROGRESS, tone: "" },
    { key: "done", label: STATUS_LABEL.DONE, value: summary.byStatus.DONE, tone: "ok" },
  ];

  const renderTask = (task: Task) =>
    isHome ? (
      <HomeTaskItem key={task.id} task={task} onOpen={openTask} />
    ) : (
      <TaskItem key={task.id} task={task} />
    );

  return (
    <>
      <section className="dash-progress">
        <div className="dash-progress-head">
          <span className="dash-progress-title">全体の進捗</span>
          <span className="dash-progress-pct">{donePct}%</span>
        </div>
        <div className="progress">
          <span className="progress-fill" style={{ width: `${donePct}%` }} />
        </div>
        <div className="dash-progress-caption muted">
          {summary.byStatus.DONE} / {summary.total} 完了
        </div>
      </section>

      <section className="stat-grid">
        {stats.map((s) => (
          <div key={s.key} className={`stat-card ${s.tone}`}>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </section>

      <section className="dash-section">
        <h2 className="section-title">期限が近いタスク</h2>
        {upcoming.length === 0 ? (
          <p className="empty">期限の設定された未完了タスクはありません。</p>
        ) : (
          <ul className="task-list">{upcoming.map(renderTask)}</ul>
        )}
      </section>

      <section className="dash-section">
        <h2 className="section-title">自分の担当</h2>
        {myTasks.length === 0 ? (
          <p className="empty">自分が担当している未完了タスクはありません。</p>
        ) : (
          <ul className="task-list">{myTasks.map(renderTask)}</ul>
        )}
      </section>
    </>
  );
}
