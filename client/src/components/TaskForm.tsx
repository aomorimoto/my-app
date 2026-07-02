import { useState, type FormEvent } from "react";
import type { Category, Member } from "../types";
import { STATUSES, PRIORITIES, STATUS_LABEL, PRIORITY_LABEL, memberLabel } from "../labels";
import { useCreateTask } from "../queries/tasks";

// タスク追加フォーム
export default function TaskForm({
  categories,
  members,
}: {
  categories: Category[];
  members: Member[];
}) {
  const create = useCreateTask();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("TODO");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    create.mutate(
      {
        title,
        description: description || null,
        status,
        priority,
        dueDate: dueDate || null,
        categoryId: categoryId ? Number(categoryId) : null,
        assigneeId: assigneeId ? Number(assigneeId) : null,
      },
      {
        onSuccess: () => {
          setTitle("");
          setDescription("");
          setStatus("TODO");
          setPriority("MEDIUM");
          setDueDate("");
          setCategoryId("");
          setAssigneeId("");
        },
        onError: (err) => setError(err.message || "追加に失敗しました。"),
      }
    );
  };

  return (
    <details className="card" open>
      <summary>タスクを追加</summary>
      <form className="form task-form" onSubmit={onSubmit}>
        {error && <p className="error">{error}</p>}
        <label className="grow">
          タイトル
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="やること"
            required
          />
        </label>
        <label className="grow">
          説明（任意）
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="メモ"
          />
        </label>
        <label>
          状態
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label>
          優先度
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </option>
            ))}
          </select>
        </label>
        <label>
          期限
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <label>
          カテゴリ
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">なし</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          担当者
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">未割当</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {memberLabel(m)}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn-primary" disabled={create.isPending}>
          追加
        </button>
      </form>
    </details>
  );
}
