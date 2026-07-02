import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchTasks,
  fetchTask,
  createTask,
  updateTask,
  toggleTask,
  deleteTask,
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

// タスクの追加・変更はダッシュボードの集計にも影響するため両方を無効化する。
function invalidateTaskViews(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["tasks"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
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
