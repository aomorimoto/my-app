import { apiFetch } from "./client";
import type { Task, TaskFilters, TasksResponse } from "../types";

// タスク作成/更新で送るフィールド（更新は部分的に送れる）。
// Phase 16: 親指定は内部 id ではなく WS 内の連番（parentNumber）。
export interface TaskInput {
  title?: string;
  description?: string | null;
  status?: string;
  priority?: string;
  dueDate?: string | null;
  assigneeId?: number | null;
  assigneeAgentId?: number | null;
  parentNumber?: number | null;
  tagIds?: number[];
  recurrenceRule?: string | null;
}

// すべて URL 駆動：対象ワークスペースは publicId でパスに含める（/api/w/:ws/tasks…）。
// タスクの識別子は WS 内の連番（number）。
export function fetchTasks(ws: string, filters: TaskFilters) {
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
  return apiFetch<TasksResponse>(`/api/w/${ws}/tasks${qs ? `?${qs}` : ""}`);
}

export const fetchTask = (ws: string, number: number) =>
  apiFetch<{ task: Task }>(`/api/w/${ws}/tasks/${number}`);

export const createTask = (ws: string, body: TaskInput) =>
  apiFetch<{ task: Task }>(`/api/w/${ws}/tasks`, { method: "POST", body });

export const updateTask = (ws: string, number: number, body: TaskInput) =>
  apiFetch<{ task: Task }>(`/api/w/${ws}/tasks/${number}`, { method: "PATCH", body });

export const toggleTask = (ws: string, number: number) =>
  apiFetch<{ task: Task }>(`/api/w/${ws}/tasks/${number}/toggle`, { method: "POST" });

export const deleteTask = (ws: string, number: number) =>
  apiFetch<null>(`/api/w/${ws}/tasks/${number}`, { method: "DELETE" });

// 兄弟内の並べ替え（D&D）。parentNumber は null でトップレベル、数値でそのサブタスク群。
// order は表示順に並んだ WS 内連番（number）の配列。
export const reorderTasks = (ws: string, parentNumber: number | null, order: number[]) =>
  apiFetch<null>(`/api/w/${ws}/tasks/reorder`, {
    method: "POST",
    body: { parentNumber, order },
  });
