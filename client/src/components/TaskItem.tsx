import { useNavigate } from "react-router-dom";
import type { DragEvent } from "react";
import type { TaskNode } from "../types";
import { STATUS_LABEL, PRIORITY_LABEL, formatDate, memberLabel } from "../labels";
import { useToggleTask } from "../queries/tasks";

// トップレベル行の D&D 用ハンドラ（サブタスク行には渡さない）。
export interface TaskDnd {
  onDragStart: (e: DragEvent) => void;
  onDragOver: (e: DragEvent) => void;
  onDrop: (e: DragEvent) => void;
  onDragEnd: (e: DragEvent) => void;
  isOver?: boolean;
}

// タスク一覧の1行。行クリックで詳細（編集/削除）へ遷移し、チェックで完了を切替える。
// サブタスクはこのコンポーネントを再帰して入れ子に表示する。
export default function TaskItem({
  task,
  depth = 0,
  dnd,
}: {
  task: TaskNode;
  depth?: number;
  dnd?: TaskDnd;
}) {
  const navigate = useNavigate();
  const toggle = useToggleTask();

  const done = task.status === "DONE";
  const overdue = !!task.dueDate && !done && new Date(task.dueDate) < new Date();

  const subtasks = task.subtasks ?? [];
  const childCount = task._count?.subtasks ?? subtasks.length;
  const doneSubtasks = subtasks.filter((s) => s.status === "DONE").length;
  const commentCount = task._count?.comments ?? 0;

  const open = () => navigate(`/tasks/${task.id}`);

  return (
    <li
      className={`task-item priority-${task.priority.toLowerCase()} ${done ? "done" : ""} ${
        dnd?.isOver ? "drag-over" : ""
      }`}
      {...(dnd
        ? {
            draggable: true,
            onDragStart: dnd.onDragStart,
            onDragOver: dnd.onDragOver,
            onDrop: dnd.onDrop,
            onDragEnd: dnd.onDragEnd,
          }
        : {})}
    >
      <div
        className="task-row"
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            open();
          }
        }}
      >
        {dnd && (
          <span className="drag-handle" title="ドラッグして並べ替え" aria-hidden>
            ⠿
          </span>
        )}
        <button
          type="button"
          className="check"
          title="完了/未完了を切替"
          onClick={(e) => {
            e.stopPropagation();
            toggle.mutate(task.id);
          }}
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
            {task.assignee && (
              <span className="badge assignee">👤 {memberLabel(task.assignee)}</span>
            )}
            {task.assigneeAgent && (
              <span
                className="badge assignee agent"
                style={{ background: task.assigneeAgent.color }}
              >
                🤖 {task.assigneeAgent.name}
              </span>
            )}
            {task.tags?.map((t) => (
              <span key={t.id} className="badge tag" style={{ background: t.color }}>
                #{t.name}
              </span>
            ))}
            {childCount > 0 && (
              <span className="badge subtasks">
                サブタスク {doneSubtasks}/{childCount}
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
        <span className="task-open-hint" aria-hidden>
          ›
        </span>
      </div>

      {subtasks.length > 0 && (
        <ul className="subtask-tree">
          {subtasks.map((s) => (
            <TaskItem key={s.id} task={s} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
