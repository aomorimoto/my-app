import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  useTask,
  useUpdateTask,
  useCreateTask,
  useToggleTask,
  useDeleteTask,
} from "../queries/tasks";
import { useAgents } from "../queries/agents";
import { useTags } from "../queries/tags";
import { useMe } from "../queries/auth";
import { useMembers } from "../queries/workspaces";
import {
  STATUSES,
  PRIORITIES,
  STATUS_LABEL,
  PRIORITY_LABEL,
  memberLabel,
  assigneeValue,
  parseAssignee,
} from "../labels";
import TagSelector from "../components/TagSelector";
import CommentThread from "../components/CommentThread";

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
  const createSubtask = useCreateTask();
  const toggleSubtask = useToggleTask();
  const deleteSubtask = useDeleteTask();

  const [form, setForm] = useState<FormState>(INITIAL);
  const [tagIds, setTagIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [subtaskTitle, setSubtaskTitle] = useState("");

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

  if (taskQ.isLoading) return <p className="muted">読み込み中…</p>;
  if (taskQ.isError || !taskQ.data?.task) return <p className="error">タスクが見つかりません。</p>;

  const task = taskQ.data.task;
  const agents = agentsQ.data?.agents ?? [];
  const tags = tagsQ.data?.tags ?? [];
  const members = membersQ.data?.members ?? [];
  const subtasks = task.subtasks ?? [];
  const isSubtask = task.parentId != null;
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
        onSuccess: () => navigate("/tasks"),
        onError: (err) => setError(err.message || "保存に失敗しました。"),
      }
    );
  };

  const onAddSubtask = (e: FormEvent) => {
    e.preventDefault();
    const title = subtaskTitle.trim();
    if (!title) return;
    createSubtask.mutate(
      { title, parentId: taskId },
      { onSuccess: () => setSubtaskTitle("") }
    );
  };

  const onDeleteSubtask = (subId: number) => {
    if (window.confirm("このサブタスクを削除しますか？")) {
      deleteSubtask.mutate(subId);
    }
  };

  return (
    <>
      <h1>タスクを編集</h1>
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
          <button type="button" className="btn-small" onClick={() => navigate("/tasks")}>
            キャンセル
          </button>
        </div>
      </form>

      {/* サブタスク（サブタスク自身にはさらにサブタスクを付けない） */}
      {!isSubtask && (
        <section className="card subtask-section">
          <h2 className="section-title">
            サブタスク（{subtasks.filter((s) => s.status === "DONE").length}/{subtasks.length}）
          </h2>
          {subtasks.length === 0 ? (
            <p className="muted">サブタスクはありません。</p>
          ) : (
            <ul className="subtask-list">
              {subtasks.map((s) => {
                const done = s.status === "DONE";
                return (
                  <li key={s.id} className={`subtask-item ${done ? "done" : ""}`}>
                    <button
                      type="button"
                      className="check"
                      title="完了/未完了を切替"
                      onClick={() => toggleSubtask.mutate(s.id)}
                      disabled={toggleSubtask.isPending}
                    >
                      {done ? "☑" : "☐"}
                    </button>
                    <span className="subtask-title">{s.title}</span>
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
          <form className="form subtask-form" onSubmit={onAddSubtask}>
            <input
              type="text"
              value={subtaskTitle}
              onChange={(e) => setSubtaskTitle(e.target.value)}
              placeholder="サブタスクを追加…"
            />
            <button type="submit" className="btn-small" disabled={createSubtask.isPending}>
              追加
            </button>
          </form>
        </section>
      )}

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
