import type { Category, Member, TaskFilters } from "../types";
import { STATUSES, PRIORITIES, STATUS_LABEL, PRIORITY_LABEL, memberLabel } from "../labels";

// 絞り込み・並び替えバー（状態は親が保持し、変更を通知する）
export default function FilterBar({
  categories,
  members,
  filters,
  onChange,
  onClear,
}: {
  categories: Category[];
  members: Member[];
  filters: TaskFilters;
  onChange: (next: TaskFilters) => void;
  onClear: () => void;
}) {
  const set = (patch: Partial<TaskFilters>) => onChange({ ...filters, ...patch });

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
        カテゴリ
        <select value={filters.category ?? ""} onChange={(e) => set({ category: e.target.value })}>
          <option value="">すべて</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        担当者
        <select value={filters.assignee ?? ""} onChange={(e) => set({ assignee: e.target.value })}>
          <option value="">すべて</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {memberLabel(m)}
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
