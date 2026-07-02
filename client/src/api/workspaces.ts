import { apiFetch } from "./client";
import type { Workspace, Member, ActiveWorkspace, Role } from "../types";

export const fetchWorkspaces = () =>
  apiFetch<{ workspaces: Workspace[] }>("/api/workspaces");

export const createWorkspace = (body: { name: string }) =>
  apiFetch<{ workspace: Workspace }>("/api/workspaces", { method: "POST", body });

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
