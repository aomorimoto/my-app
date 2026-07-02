import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchWorkspaces,
  createWorkspace,
  activateWorkspace,
  fetchMembers,
  addMember,
  updateMemberRole,
  removeMember,
} from "../api/workspaces";
import type { Role } from "../types";

export function useWorkspaces() {
  return useQuery({ queryKey: ["workspaces"], queryFn: fetchWorkspaces });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createWorkspace,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspaces"] }),
  });
}

// ワークスペース切替。表示データが総入れ替わるので関連キャッシュを無効化する。
export function useActivateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => activateWorkspace(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

export function useMembers(workspaceId: number | undefined) {
  return useQuery({
    queryKey: ["members", workspaceId],
    queryFn: () => fetchMembers(workspaceId as number),
    enabled: !!workspaceId,
  });
}

export function useAddMember(workspaceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { email: string; role?: Role }) => addMember(workspaceId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", workspaceId] });
      qc.invalidateQueries({ queryKey: ["workspaces"] }); // memberCount 変化
    },
  });
}

export function useUpdateMemberRole(workspaceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: Role }) =>
      updateMemberRole(workspaceId, userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", workspaceId] }),
  });
}

export function useRemoveMember(workspaceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => removeMember(workspaceId, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", workspaceId] });
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      // 削除メンバーの担当タスクが未割当に戻るため一覧も再取得
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
