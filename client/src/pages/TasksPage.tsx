import { useState } from "react";
import type { TaskFilters } from "../types";
import { useTasks } from "../queries/tasks";
import { useCategories } from "../queries/categories";
import { useTags } from "../queries/tags";
import { useMe } from "../queries/auth";
import { useMembers } from "../queries/workspaces";
import TaskForm from "../components/TaskForm";
import FilterBar from "../components/FilterBar";
import TaskItem from "../components/TaskItem";

const EMPTY_FILTERS: TaskFilters = {
  status: "",
  priority: "",
  category: "",
  assignee: "",
  tag: "",
  sort: "",
};

export default function TasksPage() {
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const tasksQ = useTasks(filters);
  const catsQ = useCategories();
  const tagsQ = useTags();
  const meQ = useMe();
  const membersQ = useMembers(meQ.data?.activeWorkspace?.id);

  const categories = catsQ.data?.categories ?? [];
  const tags = tagsQ.data?.tags ?? [];
  const members = membersQ.data?.members ?? [];
  const tasks = tasksQ.data?.tasks ?? [];

  return (
    <>
      <h1>タスク</h1>

      <TaskForm categories={categories} members={members} tags={tags} />

      <FilterBar
        categories={categories}
        members={members}
        tags={tags}
        filters={filters}
        onChange={setFilters}
        onClear={() => setFilters(EMPTY_FILTERS)}
      />

      {tasksQ.isLoading ? (
        <p className="muted">読み込み中…</p>
      ) : tasksQ.isError ? (
        <p className="error">タスクの取得に失敗しました。</p>
      ) : tasks.length === 0 ? (
        <p className="empty">表示するタスクがありません。上のフォームから追加しましょう。</p>
      ) : (
        <ul className="task-list">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </ul>
      )}
    </>
  );
}
