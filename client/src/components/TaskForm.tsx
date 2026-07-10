import { useState, type FormEvent, type ReactNode } from "react";
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
import RecurrenceField from "./RecurrenceField";

// フォームの初期値（サブタスク追加時に親から引き継ぐ既定値を渡すのに使う）。
export interface TaskFormSeed {
  status: string;
  priority: string;
  dueDate: string; // "YYYY-MM-DD" または ""
  assignee: string; // "" | "u:<id>" | "a:<id>"
  tagIds: number[];
}

// タスク／サブタスク追加フォーム。
// - トップレベル（既定）: 折りたたみカード（<details>）で表示する。
// - embedded=true: カード枠を持たず、フォーム本体だけを描画する（サブタスク欄への埋め込み用）。
// - parentId 指定時はサブタスクとして作成し、seed の値を初期値にする（親からの引き継ぎ）。
export default function TaskForm({
  members,
  agents,
  tags,
  parentId,
  seed,
  embedded = false,
  summaryLabel = "タスクを追加",
  submitLabel = "追加",
}: {
  members: Member[];
  agents: Agent[];
  tags: Tag[];
  parentId?: number;
  seed?: TaskFormSeed;
  embedded?: boolean;
  summaryLabel?: string;
  submitLabel?: string;
}) {
  const create = useCreateTask();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState(seed?.status ?? "TODO");
  const [priority, setPriority] = useState(seed?.priority ?? "MEDIUM");
  const [dueDate, setDueDate] = useState(seed?.dueDate ?? "");
  // 担当者は人間/AI を1つのセレクトで扱う（"" | "u:<id>" | "a:<id>"）
  const [assignee, setAssignee] = useState(seed?.assignee ?? "");
  const [tagIds, setTagIds] = useState<number[]>(seed?.tagIds ?? []);
  // 繰り返しルール（"" = なし）。サブタスクには継承しないので常に空から開始する。
  const [recurrenceRule, setRecurrenceRule] = useState("");
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
        recurrenceRule: recurrenceRule || null,
        ...(parentId != null ? { parentId } : {}),
      },
      {
        onSuccess: () => {
          // 追加後は初期値へ戻す（サブタスクなら親から引き継いだ既定値へ）。
          setTitle("");
          setDescription("");
          setStatus(seed?.status ?? "TODO");
          setPriority(seed?.priority ?? "MEDIUM");
          setDueDate(seed?.dueDate ?? "");
          setAssignee(seed?.assignee ?? "");
          setTagIds(seed?.tagIds ?? []);
          setRecurrenceRule("");
        },
        onError: (err) => setError(err.message || "追加に失敗しました。"),
      }
    );
  };

  const body: ReactNode = (
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
      {/* 繰り返しはトップレベルのタスクのみ（サブタスクの繰り返しは詳細画面で設定）。 */}
      {!embedded && (
        <RecurrenceField
          value={recurrenceRule}
          onChange={setRecurrenceRule}
          hasDueDate={!!dueDate}
        />
      )}
      <button type="submit" className="btn-primary" disabled={create.isPending}>
        {submitLabel}
      </button>
    </form>
  );

  // 埋め込み時（サブタスク欄など）はカード枠を付けず本体のみ返す。
  if (embedded) return body;

  return (
    <details className="card" open>
      <summary>{summaryLabel}</summary>
      {body}
    </details>
  );
}
