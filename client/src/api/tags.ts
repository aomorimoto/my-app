import { apiFetch } from "./client";
import type { Tag } from "../types";

export const fetchTags = () => apiFetch<{ tags: Tag[] }>("/api/tags");

export const createTag = (body: { name: string; color?: string }) =>
  apiFetch<{ tag: Tag }>("/api/tags", { method: "POST", body });

export const updateTag = (id: number, body: { name?: string; color?: string }) =>
  apiFetch<{ tag: Tag }>(`/api/tags/${id}`, { method: "PATCH", body });

export const deleteTag = (id: number) =>
  apiFetch<null>(`/api/tags/${id}`, { method: "DELETE" });
