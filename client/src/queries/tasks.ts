import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchTasks,
  fetchTask,
  createTask,
  updateTask,
  toggleTask,
  deleteTask,
  reorderTasks,
  type TaskInput,
} from "../api/tasks";
import type { TaskFilters } from "../types";

export function useTasks(filters: TaskFilters) {
  return useQuery({ queryKey: ["tasks", filters], queryFn: () => fetchTasks(filters) });
}

export function useTask(id: number) {
  return useQuery({
    queryKey: ["tasks", "detail", id],
    queryFn: () => fetchTask(id),
    enabled: Number.isFinite(id),
  });
}

// タスクの追加・変更はダッシュボード（WS単位）とメイン画面の集約ビュー（全WS横断）の
// 集計にも影響するため、まとめて無効化する。
function invalidateTaskViews(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["tasks"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
  qc.invalidateQueries({ queryKey: ["home"] });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TaskInput) => createTask(body),
    onSuccess: () => invalidateTaskViews(qc),
  });
}

export function useUpdateTask(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TaskInput) => updateTask(id, body),
    onSuccess: () => invalidateTaskViews(qc),
  });
}

export function useToggleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => toggleTask(id),
    onSuccess: () => invalidateTaskViews(qc),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTask(id),
    onSuccess: () => invalidateTaskViews(qc),
  });
}

// 兄弟内の並べ替え（D&D）。並び順（position）は一覧・詳細・集約ビューに影響するため
// 保存後にまとめて無効化して最新の順序を反映する。
export function useReorderTasks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ parentId, order }: { parentId: number | null; order: number[] }) =>
      reorderTasks(parentId, order),
    onSuccess: () => invalidateTaskViews(qc),
  });
}
