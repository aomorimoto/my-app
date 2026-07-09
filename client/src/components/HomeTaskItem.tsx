import type { Task } from "../types";
import { STATUS_LABEL, PRIORITY_LABEL, formatDate, memberLabel } from "../labels";

// 集約ビュー（メイン画面）用の読み取り専用タスク行。
// タスクは複数ワークスペースにまたがるため、TaskItem の完了/削除（アクティブWS限定）は使わず、
// クリックで useOpenTask 経由（必要ならWS切替）に詳細を開くだけにする。所属WSをバッジで示す。
export default function HomeTaskItem({
  task,
  onOpen,
}: {
  task: Task;
  onOpen: (task: Task) => void;
}) {
  const done = task.status === "DONE";
  const overdue = !!task.dueDate && !done && new Date(task.dueDate) < new Date();

  return (
    <li className={`task-item priority-${task.priority.toLowerCase()} ${done ? "done" : ""}`}>
      <button type="button" className="task-open" onClick={() => onOpen(task)} title="タスクを開く">
        <div className="task-main">
          <div className="task-title">{task.title}</div>
          <div className="task-meta">
            {task.workspace && <span className="badge ws-tag">🗂 {task.workspace.name}</span>}
            <span className="badge status">{STATUS_LABEL[task.status]}</span>
            <span className={`badge prio prio-${task.priority.toLowerCase()}`}>
              優先度: {PRIORITY_LABEL[task.priority]}
            </span>
            {task.assignee && (
              <span className="badge assignee">👤 {memberLabel(task.assignee)}</span>
            )}
            {task.assigneeAgent && (
              <span className="badge assignee agent" style={{ background: task.assigneeAgent.color }}>
                🤖 {task.assigneeAgent.name}
              </span>
            )}
            {task.dueDate && (
              <span className={`badge due ${overdue ? "overdue" : ""}`}>
                期限: {formatDate(task.dueDate)}
                {overdue ? "（超過）" : ""}
              </span>
            )}
          </div>
        </div>
      </button>
    </li>
  );
}
