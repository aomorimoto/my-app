import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTask, useUpdateTask } from "../queries/tasks";
import { useCategories } from "../queries/categories";
import { STATUSES, PRIORITIES, STATUS_LABEL, PRIORITY_LABEL } from "../labels";

interface FormState {
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
  categoryId: string;
}

const INITIAL: FormState = {
  title: "",
  description: "",
  status: "TODO",
  priority: "MEDIUM",
  dueDate: "",
  categoryId: "",
};

export default function TaskDetailPage() {
  const { id } = useParams();
  const taskId = Number(id);
  const navigate = useNavigate();

  const taskQ = useTask(taskId);
  const catsQ = useCategories();
  const update = useUpdateTask(taskId);

  const [form, setForm] = useState<FormState>(INITIAL);
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
        categoryId: task.categoryId ? String(task.categoryId) : "",
      });
    }
  }, [taskQ.data]);

  if (taskQ.isLoading) return <p className="muted">読み込み中…</p>;
  if (taskQ.isError || !taskQ.data?.task) return <p className="error">タスクが見つかりません。</p>;

  const categories = catsQ.data?.categories ?? [];
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
        categoryId: form.categoryId ? Number(form.categoryId) : null,
      },
      {
        onSuccess: () => navigate("/tasks"),
        onError: (err) => setError(err.message || "保存に失敗しました。"),
      }
    );
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
            カテゴリ
            <select value={form.categoryId} onChange={(e) => set({ categoryId: e.target.value })}>
              <option value="">なし</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
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
    </>
  );
}
