import { useEffect, useState } from "react";
import type { Task, TaskFilters } from "../types";
import { useTasks, useReorderTasks } from "../queries/tasks";
import { useAgents } from "../queries/agents";
import { useTags } from "../queries/tags";
import { useMe } from "../queries/auth";
import { useMembers } from "../queries/workspaces";
import { useDragList } from "../hooks/useDragList";
import TaskForm from "../components/TaskForm";
import FilterBar from "../components/FilterBar";
import TaskItem from "../components/TaskItem";

const EMPTY_FILTERS: TaskFilters = {
  status: "",
  priority: "",
  assignee: "",
  agent: "",
  tag: "",
  sort: "",
  q: "",
  page: 1,
};

// D&D 同期用の安定した空配列（参照を固定して useDragList の再同期ループを防ぐ）。
const EMPTY_TASKS: Task[] = [];

export default function TasksPage() {
  const [filters, setFilters] = useState<TaskFilters>(EMPTY_FILTERS);
  const [search, setSearch] = useState("");

  // 検索語はデバウンス（300ms）して filters に反映。変更時はページを先頭に戻す。
  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((prev) => {
        const q = search.trim();
        if ((prev.q ?? "") === q) return prev; // 変化がなければ再取得しない
        return { ...prev, q, page: 1 };
      });
    }, 300);
    return () => clearTimeout(id);
  }, [search]);

  const tasksQ = useTasks(filters);
  const agentsQ = useAgents();
  const tagsQ = useTags();
  const meQ = useMe();
  const membersQ = useMembers(meQ.data?.activeWorkspace?.id);

  const reorder = useReorderTasks();

  const agents = agentsQ.data?.agents ?? [];
  const tags = tagsQ.data?.tags ?? [];
  const members = membersQ.data?.members ?? [];
  const tasks = tasksQ.data?.tasks ?? EMPTY_TASKS;

  // 手動並べ替え（D&D）は「絞り込み・検索・並び替えなし」かつ 1 ページに収まるときだけ有効。
  // 条件付き・ページ分割の一覧で並べ替えると position が部分集合で書き換わり混乱するため。
  const canReorder =
    !filters.status &&
    !filters.priority &&
    !filters.assignee &&
    !filters.agent &&
    !filters.tag &&
    !filters.sort &&
    !(filters.q ?? "").trim() &&
    (tasksQ.data?.totalPages ?? 1) <= 1;

  const drag = useDragList(tasks, (ids) => reorder.mutate({ parentId: null, order: ids }));
  const displayed = canReorder ? drag.items : tasks;

  const page = filters.page ?? 1;
  const totalPages = tasksQ.data?.totalPages ?? 1;
  const total = tasksQ.data?.total ?? tasks.length;
  const pageSize = tasksQ.data?.pageSize ?? 20;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = (page - 1) * pageSize + tasks.length;

  // 削除等で総ページ数が縮み、現在ページが範囲外になったら最終ページへ寄せる。
  useEffect(() => {
    const tp = tasksQ.data?.totalPages;
    if (tp && page > tp) setFilters((prev) => ({ ...prev, page: tp }));
  }, [tasksQ.data?.totalPages, page]);

  // 絞り込み・並び替えが変わったら1ページ目に戻す。
  const onFilterChange = (next: TaskFilters) => setFilters({ ...next, page: 1 });
  const onClear = () => {
    setSearch("");
    setFilters(EMPTY_FILTERS);
  };
  const goPage = (p: number) => setFilters((prev) => ({ ...prev, page: p }));

  return (
    <>
      <h1>タスク</h1>

      <TaskForm members={members} agents={agents} tags={tags} />

      <div className="search-bar card">
        <span className="search-icon">🔍</span>
        <input
          type="search"
          className="search-input"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="タイトル・説明で検索"
        />
      </div>

      <FilterBar
        members={members}
        agents={agents}
        tags={tags}
        filters={filters}
        onChange={onFilterChange}
        onClear={onClear}
      />

      {tasksQ.isLoading ? (
        <p className="muted">読み込み中…</p>
      ) : tasksQ.isError ? (
        <p className="error">タスクの取得に失敗しました。</p>
      ) : tasks.length === 0 ? (
        <p className="empty">表示するタスクがありません。条件を変えるか、上のフォームから追加しましょう。</p>
      ) : (
        <>
          {canReorder && (
            <p className="muted reorder-hint">⠿ ドラッグでタスクを並べ替えできます。</p>
          )}
          <ul className="task-list">
            {displayed.map((task, i) => (
              <TaskItem
                key={task.id}
                task={task}
                dnd={
                  canReorder
                    ? {
                        onDragStart: drag.onDragStart(i),
                        onDragOver: drag.onDragOver(i),
                        onDrop: drag.onDrop(i),
                        onDragEnd: drag.onDragEnd,
                        isOver: drag.overIndex === i,
                      }
                    : undefined
                }
              />
            ))}
          </ul>

          <div className="pagination">
            <button
              type="button"
              className="btn-small"
              onClick={() => goPage(page - 1)}
              disabled={page <= 1}
            >
              ← 前へ
            </button>
            <span className="muted">
              全 {total} 件中 {from}–{to}（{page}/{totalPages}）
            </span>
            <button
              type="button"
              className="btn-small"
              onClick={() => goPage(page + 1)}
              disabled={page >= totalPages}
            >
              次へ →
            </button>
          </div>
        </>
      )}
    </>
  );
}
