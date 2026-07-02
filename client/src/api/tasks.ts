import { apiFetch } from "./client";
import type { Task, TaskFilters } from "../types";

// タスク作成/更新で送るフィールド（更新は部分的に送れる）
export interface TaskInput {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  categoryId?: number | null;
  assigneeId?: number | null;
  parentId?: number | null;
  tagIds?: number[];
}

export function fetchTasks(filters: TaskFilters) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.category) params.set("category", filters.category);
  if (filters.assignee) params.set("assignee", filters.assignee);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.sort) params.set("sort", filters.sort);
  const qs = params.toString();
  return apiFetch<{ tasks: Task[] }>(`/api/tasks${qs ? `?${qs}` : ""}`);
}

export const fetchTask = (id: number) => apiFetch<{ task: Task }>(`/api/tasks/${id}`);

export const createTask = (body: TaskInput) =>
  apiFetch<{ task: Task }>("/api/tasks", { method: "POST", body });

export const updateTask = (id: number, body: TaskInput) =>
  apiFetch<{ task: Task }>(`/api/tasks/${id}`, { method: "PATCH", body });

export const toggleTask = (id: number) =>
  apiFetch<{ task: Task }>(`/api/tasks/${id}/toggle`, { method: "POST" });

export const deleteTask = (id: number) =>
  apiFetch<null>(`/api/tasks/${id}`, { method: "DELETE" });
