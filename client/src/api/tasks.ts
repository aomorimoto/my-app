import { apiFetch } from "./client";
import type { Task, TaskFilters, TasksResponse } from "../types";

// タスク作成/更新で送るフィールド（更新は部分的に送れる）
export interface TaskInput {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  assigneeId?: number | null;
  assigneeAgentId?: number | null;
  parentId?: number | null;
  tagIds?: number[];
  recurrenceRule?: string | null;
}

export function fetchTasks(filters: TaskFilters) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.assignee) params.set("assignee", filters.assignee);
  if (filters.agent) params.set("agent", filters.agent);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.sort) params.set("sort", filters.sort);
  if (filters.q && filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.page) params.set("page", String(filters.page));
  const qs = params.toString();
  return apiFetch<TasksResponse>(`/api/tasks${qs ? `?${qs}` : ""}`);
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

// 兄弟内の並べ替え（D&D）。parentId は null でトップレベル、数値でそのサブタスク群。
export const reorderTasks = (parentId: number | null, order: number[]) =>
  apiFetch<null>("/api/tasks/reorder", { method: "POST", body: { parentId, order } });
