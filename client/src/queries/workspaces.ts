import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchWorkspaces,
  createWorkspace,
  updateWorkspace,
  reorderWorkspaces,
  activateWorkspace,
  fetchMembers,
  addMember,
  updateMemberRole,
  removeMember,
  type UpdateWorkspaceInput,
} from "../api/workspaces";
import type { Role, Workspace } from "../types";

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

// ワークスペースの名前・アイコン更新。一覧とアクティブWS表示（me）を再取得する。
export function useUpdateWorkspace(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateWorkspaceInput) => updateWorkspace(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["home"] }); // 集約ビューのWSバッジにも反映
    },
  });
}

// メイン画面の並べ替え。サーバ応答（新しい順序）で workspaces キャッシュを差し替える。
export function useReorderWorkspaces() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: number[]) => reorderWorkspaces(order),
    onSuccess: (data) => {
      qc.setQueryData<{ workspaces: Workspace[] }>(["workspaces"], data);
    },
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
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["tags"] });
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
