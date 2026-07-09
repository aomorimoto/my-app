import { useState, type FormEvent } from "react";
import type { Agent, Member, Tag } from "../types";
import {
  STATUSES,
  PRIORITIES,
  STATUS_LABEL,
  PRIORITY_LABEL,
  memberLabel,
  parseAssignee,
} from "../labels";
import { useCreateTask } from "../queries/tasks";
import TagSelector from "./TagSelector";

// タスク追加フォーム
export default function TaskForm({
  members,
  agents,
  tags,
}: {
  members: Member[];
  agents: Agent[];
  tags: Tag[];
}) {
  const create = useCreateTask();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("TODO");
  const [priority, setPriority] = useState("MEDIUM");
  const [dueDate, setDueDate] = useState("");
  // 担当者は人間/AI を1つのセレクトで扱う（"" | "u:<id>" | "a:<id>"）
  const [assignee, setAssignee] = useState("");
  const [tagIds, setTagIds] = useState<number[]>([]);
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
        ...parseAssignee(assignee),
        tagIds,
      },
      {
        onSuccess: () => {
          setTitle("");
          setDescription("");
          setStatus("TODO");
          setPriority("MEDIUM");
          setDueDate("");
          setAssignee("");
          setTagIds([]);
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
          担当者
          <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
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
        <div className="tags-field">
          <span className="field-label">タグ</span>
          <TagSelector tags={tags} selected={tagIds} onChange={setTagIds} />
        </div>
        <button type="submit" className="btn-primary" disabled={create.isPending}>
          追加
        </button>
      </form>
    </details>
  );
}
