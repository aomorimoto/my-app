import { apiFetch } from "./client";
import type { Tag } from "../types";

// タグはワークスペース・スコープ配下（/api/w/:ws/tags…）。
export const fetchTags = (ws: string) => apiFetch<{ tags: Tag[] }>(`/api/w/${ws}/tags`);

export const createTag = (ws: string, body: { name: string; color?: string }) =>
  apiFetch<{ tag: Tag }>(`/api/w/${ws}/tags`, { method: "POST", body });

export const updateTag = (ws: string, id: number, body: { name?: string; color?: string }) =>
  apiFetch<{ tag: Tag }>(`/api/w/${ws}/tags/${id}`, { method: "PATCH", body });

export const deleteTag = (ws: string, id: number) =>
  apiFetch<null>(`/api/w/${ws}/tags/${id}`, { method: "DELETE" });
