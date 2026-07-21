import { apiFetch } from "./client";
import type { Comment } from "../types";

// コメントはタスク配下（/api/w/:ws/tasks/:number/comments…）。タスクは WS 内の連番で指定。
export const fetchComments = (ws: string, number: number) =>
  apiFetch<{ comments: Comment[] }>(`/api/w/${ws}/tasks/${number}/comments`);

export const createComment = (ws: string, number: number, body: { body: string }) =>
  apiFetch<{ comment: Comment }>(`/api/w/${ws}/tasks/${number}/comments`, { method: "POST", body });

export const updateComment = (ws: string, number: number, id: number, body: { body: string }) =>
  apiFetch<{ comment: Comment }>(`/api/w/${ws}/tasks/${number}/comments/${id}`, {
    method: "PATCH",
    body,
  });

export const deleteComment = (ws: string, number: number, id: number) =>
  apiFetch<null>(`/api/w/${ws}/tasks/${number}/comments/${id}`, { method: "DELETE" });
