import { apiFetch } from "./client";
import type { Comment } from "../types";

export const fetchComments = (taskId: number) =>
  apiFetch<{ comments: Comment[] }>(`/api/tasks/${taskId}/comments`);

export const createComment = (taskId: number, body: { body: string }) =>
  apiFetch<{ comment: Comment }>(`/api/tasks/${taskId}/comments`, { method: "POST", body });

export const updateComment = (taskId: number, id: number, body: { body: string }) =>
  apiFetch<{ comment: Comment }>(`/api/tasks/${taskId}/comments/${id}`, {
    method: "PATCH",
    body,
  });

export const deleteComment = (taskId: number, id: number) =>
  apiFetch<null>(`/api/tasks/${taskId}/comments/${id}`, { method: "DELETE" });
