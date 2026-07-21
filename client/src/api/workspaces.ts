import { apiFetch } from "./client";
import type { Workspace, Member, Role } from "../types";

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

// 対象は publicId で指定（内部 id は使わない）。
export const updateWorkspace = (publicId: string, body: UpdateWorkspaceInput) =>
  apiFetch<{ workspace: Workspace }>(`/api/workspaces/${publicId}`, { method: "PATCH", body });

// ワークスペース削除（OWNER のみ）。誤削除防止のため確認用の名前を送る。
export const deleteWorkspace = (publicId: string, name: string) =>
  apiFetch<null>(`/api/workspaces/${publicId}`, { method: "DELETE", body: { name } });

// メイン画面の並べ替え結果を保存する（表示順に並んだ workspace publicId の配列）。
export const reorderWorkspaces = (order: string[]) =>
  apiFetch<{ workspaces: Workspace[] }>("/api/workspaces/reorder", {
    method: "POST",
    body: { order },
  });

// メンバー管理はワークスペース・スコープ配下（/api/w/:ws/members…）。
export const fetchMembers = (ws: string) =>
  apiFetch<{ members: Member[] }>(`/api/w/${ws}/members`);

export const addMember = (ws: string, body: { username: string; role?: Role }) =>
  apiFetch<{ member: Member }>(`/api/w/${ws}/members`, { method: "POST", body });

export const updateMemberRole = (ws: string, userId: number, role: Role) =>
  apiFetch<{ member: Member }>(`/api/w/${ws}/members/${userId}`, {
    method: "PATCH",
    body: { role },
  });

export const removeMember = (ws: string, userId: number) =>
  apiFetch<null>(`/api/w/${ws}/members/${userId}`, { method: "DELETE" });
