import { useDashboard } from "../queries/dashboard";
import { STATUS_LABEL } from "../labels";
import TaskItem from "../components/TaskItem";

export default function DashboardPage() {
  const { data, isLoading, isError } = useDashboard();

  if (isLoading) return <p className="muted">読み込み中…</p>;
  if (isError || !data) return <p className="error">ダッシュボードの取得に失敗しました。</p>;

  const { summary, upcoming, myTasks } = data;

  // 集計カード（色調は期限系＝警告、完了＝OK）
  const stats = [
    { key: "overdue", label: "期限超過", value: summary.overdue, tone: "danger" },
    { key: "dueToday", label: "今日締切", value: summary.dueToday, tone: "warn" },
    { key: "dueThisWeek", label: "今週締切", value: summary.dueThisWeek, tone: "warn" },
    { key: "todo", label: STATUS_LABEL.TODO, value: summary.byStatus.TODO, tone: "" },
    { key: "inprog", label: STATUS_LABEL.IN_PROGRESS, value: summary.byStatus.IN_PROGRESS, tone: "" },
    { key: "done", label: STATUS_LABEL.DONE, value: summary.byStatus.DONE, tone: "ok" },
  ];

  return (
    <>
      <h1>ダッシュボード</h1>

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
          <ul className="task-list">
            {upcoming.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </ul>
        )}
      </section>

      <section className="dash-section">
        <h2 className="section-title">自分の担当</h2>
        {myTasks.length === 0 ? (
          <p className="empty">自分が担当している未完了タスクはありません。</p>
        ) : (
          <ul className="task-list">
            {myTasks.map((task) => (
              <TaskItem key={task.id} task={task} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
