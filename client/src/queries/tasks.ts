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
import { useWsPublicId } from "../lib/workspaceContext";
import type { TaskFilters } from "../types";

// これらのフックはワークスペース・スコープ配下（/w/:wsPublicId/*）で使う。
// 現在の publicId は Context から取得し、クエリキーにも含めて WS ごとにキャッシュを分ける。

export function useTasks(filters: TaskFilters) {
  const ws = useWsPublicId();
  return useQuery({ queryKey: ["tasks", ws, filters], queryFn: () => fetchTasks(ws, filters) });
}

export function useTask(number: number) {
  const ws = useWsPublicId();
  return useQuery({
    queryKey: ["tasks", ws, "detail", number],
    queryFn: () => fetchTask(ws, number),
    enabled: Number.isFinite(number),
  });
}

// タスクの追加・変更はダッシュボード（WS単位）とメイン画面の集約ビュー（全WS横断）の
// 集計にも影響するため、まとめて無効化する（キーの接頭辞一致で全WS分を含む）。
function invalidateTaskViews(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["tasks"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
  qc.invalidateQueries({ queryKey: ["home"] });
}

export function useCreateTask() {
  const ws = useWsPublicId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TaskInput) => createTask(ws, body),
    onSuccess: () => invalidateTaskViews(qc),
  });
}

export function useUpdateTask(number: number) {
  const ws = useWsPublicId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TaskInput) => updateTask(ws, number, body),
    onSuccess: () => invalidateTaskViews(qc),
  });
}

export function useToggleTask() {
  const ws = useWsPublicId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (number: number) => toggleTask(ws, number),
    onSuccess: () => invalidateTaskViews(qc),
  });
}

export function useDeleteTask() {
  const ws = useWsPublicId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (number: number) => deleteTask(ws, number),
    onSuccess: () => invalidateTaskViews(qc),
  });
}

// 兄弟内の並べ替え（D&D）。並び順（position）は一覧・詳細・集約ビューに影響するため
// 保存後にまとめて無効化して最新の順序を反映する。order は number の配列。
export function useReorderTasks() {
  const ws = useWsPublicId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ parentNumber, order }: { parentNumber: number | null; order: number[] }) =>
      reorderTasks(ws, parentNumber, order),
    onSuccess: () => invalidateTaskViews(qc),
  });
}
