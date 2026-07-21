import { useNavigate } from "react-router-dom";
import type { Task, TaskFilters } from "../types";
import { useTasks } from "../queries/tasks";
import { useWsPublicId } from "../lib/workspaceContext";
import CalendarGrid from "../components/CalendarGrid";

// カレンダーは全タスク（トップレベル）の期限を対象にするので絞り込みなしで取得する。
// TasksPage と同じ空フィルタ形なので React Query のキャッシュを共有できる。
const NO_FILTERS: TaskFilters = {
  status: "",
  priority: "",
  assignee: "",
  agent: "",
  tag: "",
  sort: "",
};

// ワークスペース画面のカレンダータブ。アクティブなWSのタスクを表示する。
export default function CalendarPage() {
  const navigate = useNavigate();
  const ws = useWsPublicId();
  const { data, isLoading, isError } = useTasks(NO_FILTERS);
  const tasks = data?.tasks ?? [];

  return (
    <>
      <h1>カレンダー</h1>
      {isLoading ? (
        <p className="muted">読み込み中…</p>
      ) : isError ? (
        <p className="error">タスクの取得に失敗しました。</p>
      ) : (
        <CalendarGrid tasks={tasks} onOpenTask={(t: Task) => navigate(`/w/${ws}/tasks/${t.number}`)} />
      )}
    </>
  );
}
