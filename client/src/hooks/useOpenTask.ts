import { useNavigate } from "react-router-dom";
import type { Task } from "../types";

// 集約ビュー（メイン画面のダッシュボード/カレンダー）からタスクを開くための遷移フック。
// タスクは複数ワークスペースにまたがるため、そのタスクの所属WS（publicId）と WS 内連番（number）で
// URL を組み立てて詳細へ遷移する（Phase 16: URL 駆動。セッションのアクティブWS切替は不要）。
export function useOpenTask() {
  const navigate = useNavigate();

  return (task: Pick<Task, "number" | "workspace">) => {
    const ws = task.workspace?.publicId;
    if (ws && task.number != null) navigate(`/w/${ws}/tasks/${task.number}`);
  };
}
