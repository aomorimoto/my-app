import { useNavigate } from "react-router-dom";
import { useMe } from "../queries/auth";
import { useActivateWorkspace } from "../queries/workspaces";
import type { Task } from "../types";

// 集約ビュー（メイン画面のダッシュボード/カレンダー）からタスクを開くための遷移フック。
// タスク詳細（/api/tasks/:id）はアクティブなワークスペースに限定されるため、
// 別ワークスペースのタスクを開くときは、そのWSをアクティブ化してから詳細へ遷移する。
export function useOpenTask() {
  const navigate = useNavigate();
  const activate = useActivateWorkspace();
  const meQ = useMe();
  const activeId = meQ.data?.activeWorkspace?.id;

  return (task: Pick<Task, "id" | "workspace">) => {
    const wsId = task.workspace?.id;
    if (wsId && wsId !== activeId) {
      activate.mutate(wsId, { onSuccess: () => navigate(`/tasks/${task.id}`) });
    } else {
      navigate(`/tasks/${task.id}`);
    }
  };
}
