import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useTask,
  useUpdateTask,
  useToggleTask,
  useDeleteTask,
  useReorderTasks,
} from "../queries/tasks";
import { useAgents } from "../queries/agents";
import { useTags } from "../queries/tags";
import { useMe } from "../queries/auth";
import { useMembers } from "../queries/workspaces";
import { useDragList } from "../hooks/useDragList";
import {
  STATUSES,
  PRIORITIES,
  STATUS_LABEL,
  PRIORITY_LABEL,
  memberLabel,
  assigneeValue,
  parseAssignee,
  formatDate,
  statusClass,
} from "../labels";
import type { TaskNode } from "../types";
import TagSelector from "../components/TagSelector";
import TaskForm from "../components/TaskForm";
import CommentThread from "../components/CommentThread";

// D&D 同期用の安定した空配列。
const EMPTY_NODES: TaskNode[] = [];

interface FormState {
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
  // 担当者は人間/AI を1セレクトで扱う（"" | "u:<id>" | "a:<id>"）
  assignee: string;
}

const INITIAL: FormState = {
  title: "",
  description: "",
  status: "TODO",
  priority: "MEDIUM",
  dueDate: "",
  assignee: "",
};

export default function TaskDetailPage() {
  const { id } = useParams();
  const taskId = Number(id);
  const navigate = useNavigate();

  const taskQ = useTask(taskId);
  const agentsQ = useAgents();
  const tagsQ = useTags();
  const meQ = useMe();
  const membersQ = useMembers(meQ.data?.activeWorkspace?.id);
  const update = useUpdateTask(taskId);

  // サブタスク操作（親と同じ tasks クエリを共有）
  const toggleSubtask = useToggleTask();
  const deleteSubtask = useDeleteTask();
  const del = useDeleteTask(); // このタスク自身の削除
  const reorder = useReorderTasks();

  const [form, setForm] = useState<FormState>(INITIAL);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);

  // 取得したタスクをフォームに反映
  useEffect(() => {
    const task = taskQ.data?.task;
    if (task) {
      setForm({
        title: task.title,
        description: task.description ?? "",
        status: task.status,
        priority: task.priority,
        dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
        assignee: assigneeValue(task),
      });
      setTagIds((task.tags ?? []).map((t) => t.id));
    }
  }, [taskQ.data]);

  // サブタスクの D&D 並べ替え（フックは早期 return より前に呼ぶ）。
  const subtaskSource = taskQ.data?.task?.subtasks ?? EMPTY_NODES;
  const subDrag = useDragList(subtaskSource, (ids) =>
    reorder.mutate({ parentId: taskId, order: ids })
  );

  if (taskQ.isLoading) return <p className="muted">読み込み中…</p>;
  if (taskQ.isError || !taskQ.data?.task) return <p className="error">タスクが見つかりません。</p>;

  const task = taskQ.data.task;
  const agents = agentsQ.data?.agents ?? [];
  const tags = tagsQ.data?.tags ?? [];
  const members = membersQ.data?.members ?? [];
  const isSubtask = task.parentId != null;
  // 保存/削除/キャンセル後の戻り先（サブタスクなら親タスク、そうでなければ一覧）。
  const backTo = isSubtask ? `/tasks/${task.parentId}` : "/tasks";
  const subtasks = subDrag.items;
  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    update.mutate(
      {
        title: form.title,
        description: form.description || null,
        status: form.status,
        priority: form.priority,
        dueDate: form.dueDate || null,
        ...parseAssignee(form.assignee),
        tagIds,
      },
      {
        onSuccess: () => navigate(backTo),
        onError: (err) => setError(err.message || "保存に失敗しました。"),
      }
    );
  };

  // タスク自身の削除（サブタスクも連鎖削除）。削除後は親か一覧へ戻る。
  const onDeleteTask = () => {
    if (window.confirm("このタスクを削除しますか？（サブタスクも一緒に削除されます）")) {
      del.mutate(taskId, { onSuccess: () => navigate(backTo) });
    }
  };

  const onDeleteSubtask = (subId: number) => {
    if (window.confirm("このサブタスクを削除しますか？（配下のサブタスクも削除されます）")) {
      deleteSubtask.mutate(subId);
    }
  };

  return (
    <>
      {isSubtask && (
        <p className="breadcrumb">
          <Link to={`/tasks/${task.parentId}`}>← 親タスクへ</Link>
        </p>
      )}
      <h1>{isSubtask ? "サブタスクを編集" : "タスクを編集"}</h1>
      <form className="form card edit-form" onSubmit={onSubmit}>
        {error && <p className="error">{error}</p>}
        <label>
          タイトル
          <input type="text" value={form.title} onChange={(e) => set({ title: e.target.value })} required />
        </label>
        <label>
          説明
          <textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} />
        </label>
        <div className="row">
          <label>
            状態
            <select value={form.status} onChange={(e) => set({ status: e.target.value })}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            優先度
            <select value={form.priority} onChange={(e) => set({ priority: e.target.value })}>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_LABEL[p]}
                </option>
              ))}
            </select>
          </label>
          <label>
            期限
            <input type="date" value={form.dueDate} onChange={(e) => set({ dueDate: e.target.value })} />
          </label>
          <label>
            担当者
            <select value={form.assignee} onChange={(e) => set({ assignee: e.target.value })}>
              <option value="">未割当</option>
              {members.length > 0 && (
                <optgroup label="👤 メンバー">
                  {members.map((m) => (
                    <option key={`u:${m.id}`} value={`u:${m.id}`}>
                      {memberLabel(m)}
                    </option>
                  ))}
                </optgroup>
              )}
              {agents.length > 0 && (
                <optgroup label="🤖 AI エージェント">
                  {agents.map((a) => (
                    <option key={`a:${a.id}`} value={`a:${a.id}`}>
                      {a.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
        </div>
        <div className="tags-field">
          <span className="field-label">タグ</span>
          <TagSelector tags={tags} selected={tagIds} onChange={setTagIds} />
        </div>
        <div className="actions">
          <button type="submit" className="btn-primary" disabled={update.isPending}>
            保存
          </button>
          <button type="button" className="btn-small" onClick={() => navigate(backTo)}>
            キャンセル
          </button>
          <button
            type="button"
            className="btn-small danger delete-task"
            onClick={onDeleteTask}
            disabled={del.isPending}
          >
            削除
          </button>
        </div>
      </form>

      {/* サブタスク（多階層。各行をクリックすると、そのサブタスクの編集画面へ） */}
      <section className="card subtask-section">
        <h2 className="section-title">
          サブタスク（{subtasks.filter((s) => s.status === "DONE").length}/{subtasks.length}）
        </h2>
        {subtasks.length === 0 ? (
          <p className="muted">サブタスクはありません。</p>
        ) : (
          <ul className="subtask-list">
            {subtasks.map((s, i) => {
              const done = s.status === "DONE";
              const childCount = s._count?.subtasks ?? s.subtasks?.length ?? 0;
              const overdue = !!s.dueDate && !done && new Date(s.dueDate) < new Date();
              return (
                <li
                  key={s.id}
                  className={`subtask-item ${done ? "done" : ""} ${
                    subDrag.overIndex === i ? "drag-over" : ""
                  }`}
                  draggable
                  onDragStart={subDrag.onDragStart(i)}
                  onDragOver={subDrag.onDragOver(i)}
                  onDrop={subDrag.onDrop(i)}
                  onDragEnd={subDrag.onDragEnd}
                >
                  <span className="drag-handle" title="ドラッグして並べ替え" aria-hidden>
                    ⠿
                  </span>
                  <button
                    type="button"
                    className="check"
                    title="完了/未完了を切替"
                    onClick={() => toggleSubtask.mutate(s.id)}
                    disabled={toggleSubtask.isPending}
                  >
                    {done ? "☑" : "☐"}
                  </button>
                  <Link to={`/tasks/${s.id}`} className="subtask-main">
                    <span className="subtask-title">{s.title}</span>
                    <span className="subtask-meta">
                      <span className={`badge status ${statusClass(s.status)}`}>
                        {STATUS_LABEL[s.status]}
                      </span>
                      <span className={`badge prio prio-${s.priority.toLowerCase()}`}>
                        優先度: {PRIORITY_LABEL[s.priority]}
                      </span>
                      {s.assignee && (
                        <span className="badge assignee">👤 {memberLabel(s.assignee)}</span>
                      )}
                      {s.assigneeAgent && (
                        <span
                          className="badge assignee agent"
                          style={{ background: s.assigneeAgent.color }}
                        >
                          🤖 {s.assigneeAgent.name}
                        </span>
                      )}
                      {s.tags?.map((t) => (
                        <span key={t.id} className="badge tag" style={{ background: t.color }}>
                          #{t.name}
                        </span>
                      ))}
                      {childCount > 0 && (
                        <span className="badge subtasks">サブタスク {childCount}</span>
                      )}
                      {s.dueDate && (
                        <span className={`badge due ${overdue ? "overdue" : ""}`}>
                          期限: {formatDate(s.dueDate)}
                          {overdue ? "（超過）" : ""}
                        </span>
                      )}
                    </span>
                  </Link>
                  <button
                    type="button"
                    className="btn-small danger"
                    onClick={() => onDeleteSubtask(s.id)}
                    disabled={deleteSubtask.isPending}
                  >
                    削除
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <h3 className="subtask-add-title">サブタスクを追加</h3>
        <TaskForm
          embedded
          parentId={taskId}
          members={members}
          agents={agents}
          tags={tags}
          seed={{
            status: task.status,
            priority: task.priority,
            dueDate: task.dueDate ? task.dueDate.slice(0, 10) : "",
            assignee: assigneeValue(task),
            tagIds: (task.tags ?? []).map((t) => t.id),
          }}
        />
      </section>

      {/* コメント */}
      <div className="card">
        <CommentThread
          taskId={taskId}
          currentUserId={meQ.data?.user?.id}
          role={meQ.data?.activeWorkspace?.role}
        />
      </div>
    </>
  );
}
