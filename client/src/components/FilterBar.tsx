import type { Agent, Member, Tag, TaskFilters } from "../types";
import { STATUSES, PRIORITIES, STATUS_LABEL, PRIORITY_LABEL, memberLabel } from "../labels";

// 絞り込み・並び替えバー（状態は親が保持し、変更を通知する）
export default function FilterBar({
  members,
  agents,
  tags,
  filters,
  onChange,
  onClear,
}: {
  members: Member[];
  agents: Agent[];
  tags: Tag[];
  filters: TaskFilters;
  onChange: (next: TaskFilters) => void;
  onClear: () => void;
}) {
  const set = (patch: Partial<TaskFilters>) => onChange({ ...filters, ...patch });

  // 担当者フィルタは人間/AI を1セレクトで扱う（"" | "u:<id>" | "a:<id>"）
  const assigneeSel = filters.agent ? `a:${filters.agent}` : filters.assignee ? `u:${filters.assignee}` : "";
  const onAssigneeChange = (value: string) => {
    if (value.startsWith("a:")) set({ assignee: "", agent: value.slice(2) });
    else if (value.startsWith("u:")) set({ assignee: value.slice(2), agent: "" });
    else set({ assignee: "", agent: "" });
  };

  return (
    <div className="filter-bar card">
      <label>
        状態
        <select
          value={filters.status ?? ""}
          onChange={(e) => set({ status: e.target.value as TaskFilters["status"] })}
        >
          <option value="">すべて</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      </label>
      <label>
        優先度
        <select
          value={filters.priority ?? ""}
          onChange={(e) => set({ priority: e.target.value as TaskFilters["priority"] })}
        >
          <option value="">すべて</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABEL[p]}
            </option>
          ))}
        </select>
      </label>
      <label>
        担当者
        <select value={assigneeSel} onChange={(e) => onAssigneeChange(e.target.value)}>
          <option value="">すべて</option>
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
      <label>
        タグ
        <select value={filters.tag ?? ""} onChange={(e) => set({ tag: e.target.value })}>
          <option value="">すべて</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        並び替え
        <select
          value={filters.sort ?? ""}
          onChange={(e) => set({ sort: e.target.value as TaskFilters["sort"] })}
        >
          <option value="">作成が新しい順</option>
          <option value="dueDate">期限が近い順</option>
          <option value="priority">優先度が高い順</option>
        </select>
      </label>
      <button type="button" className="link-btn clear-link" onClick={onClear}>
        クリア
      </button>
    </div>
  );
}
