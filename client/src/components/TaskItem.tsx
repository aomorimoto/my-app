import { Link } from "react-router-dom";
import type { Task } from "../types";
import { STATUS_LABEL, PRIORITY_LABEL, formatDate, memberLabel } from "../labels";
import { useToggleTask, useDeleteTask } from "../queries/tasks";

export default function TaskItem({ task }: { task: Task }) {
  const toggle = useToggleTask();
  const del = useDeleteTask();

  const done = task.status === "DONE";
  const overdue = !!task.dueDate && !done && new Date(task.dueDate) < new Date();

  const subtasks = task.subtasks ?? [];
  const doneSubtasks = subtasks.filter((s) => s.status === "DONE").length;
  const commentCount = task._count?.comments ?? 0;

  const onDelete = () => {
    if (window.confirm("このタスクを削除しますか？")) {
      del.mutate(task.id);
    }
  };

  return (
    <li className={`task-item priority-${task.priority.toLowerCase()} ${done ? "done" : ""}`}>
      <button
        type="button"
        className="check"
        title="完了/未完了を切替"
        onClick={() => toggle.mutate(task.id)}
        disabled={toggle.isPending}
      >
        {done ? "☑" : "☐"}
      </button>
      <div className="task-main">
        <div className="task-title">{task.title}</div>
        {task.description && <div className="task-desc">{task.description}</div>}
        <div className="task-meta">
          <span className="badge status">{STATUS_LABEL[task.status]}</span>
          <span className={`badge prio prio-${task.priority.toLowerCase()}`}>
            優先度: {PRIORITY_LABEL[task.priority]}
          </span>
          {task.category && (
            <span className="badge cat" style={{ background: task.category.color }}>
              {task.category.name}
            </span>
          )}
          {task.assignee && (
            <span className="badge assignee">👤 {memberLabel(task.assignee)}</span>
          )}
          {task.tags?.map((t) => (
            <span key={t.id} className="badge tag" style={{ background: t.color }}>
              #{t.name}
            </span>
          ))}
          {subtasks.length > 0 && (
            <span className="badge subtasks">
              サブタスク {doneSubtasks}/{subtasks.length}
            </span>
          )}
          {commentCount > 0 && <span className="badge comments">💬 {commentCount}</span>}
          {task.dueDate && (
            <span className={`badge due ${overdue ? "overdue" : ""}`}>
              期限: {formatDate(task.dueDate)}
              {overdue ? "（超過）" : ""}
            </span>
          )}
        </div>
      </div>
      <div className="task-actions">
        <Link className="btn-small" to={`/tasks/${task.id}`}>
          編集
        </Link>
        <button type="button" className="btn-small danger" onClick={onDelete} disabled={del.isPending}>
          削除
        </button>
      </div>
    </li>
  );
}
