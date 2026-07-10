import { apiFetch } from "./client";
import type { Workspace, Member, ActiveWorkspace, Role } from "../types";

export const fetchWorkspaces = () =>
  apiFetch<{ workspaces: Workspace[] }>("/api/workspaces");

export const createWorkspace = (body: { name: string }) =>
  apiFetch<{ workspace: Workspace }>("/api/workspaces", { method: "POST", body });

// ワークスペースの名前・アイコンを更新（OWNER/ADMIN）。送る項目のみ更新。
export interface UpdateWorkspaceInput {
  name?: string;
  iconColor?: string | null;
  iconImage?: string | null;
}

export const updateWorkspace = (id: number, body: UpdateWorkspaceInput) =>
  apiFetch<{ workspace: Workspace }>(`/api/workspaces/${id}`, { method: "PATCH", body });

// ワークスペース削除（OWNER のみ）。誤削除防止のため確認用の名前を送る。
export const deleteWorkspace = (id: number, name: string) =>
  apiFetch<null>(`/api/workspaces/${id}`, { method: "DELETE", body: { name } });

// メイン画面の並べ替え結果を保存する（表示順に並んだ workspaceId の配列）
export const reorderWorkspaces = (order: number[]) =>
  apiFetch<{ workspaces: Workspace[] }>("/api/workspaces/reorder", {
    method: "POST",
    body: { order },
  });

export const activateWorkspace = (id: number) =>
  apiFetch<{ activeWorkspace: ActiveWorkspace | null }>(`/api/workspaces/${id}/activate`, {
    method: "POST",
  });

export const fetchMembers = (workspaceId: number) =>
  apiFetch<{ members: Member[] }>(`/api/workspaces/${workspaceId}/members`);

export const addMember = (workspaceId: number, body: { email: string; role?: Role }) =>
  apiFetch<{ member: Member }>(`/api/workspaces/${workspaceId}/members`, {
    method: "POST",
    body,
  });

export const updateMemberRole = (workspaceId: number, userId: number, role: Role) =>
  apiFetch<{ member: Member }>(`/api/workspaces/${workspaceId}/members/${userId}`, {
    method: "PATCH",
    body: { role },
  });

export const removeMember = (workspaceId: number, userId: number) =>
  apiFetch<null>(`/api/workspaces/${workspaceId}/members/${userId}`, { method: "DELETE" });
