import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchWorkspaces,
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  reorderWorkspaces,
  fetchMembers,
  addMember,
  updateMemberRole,
  removeMember,
  type UpdateWorkspaceInput,
} from "../api/workspaces";
import { useWsPublicId } from "../lib/workspaceContext";
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

// ワークスペースの名前・アイコン更新（対象は publicId）。一覧と集約ビューを再取得する。
export function useUpdateWorkspace(publicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateWorkspaceInput) => updateWorkspace(publicId, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      qc.invalidateQueries({ queryKey: ["home"] }); // 集約ビューのWSバッジにも反映
    },
  });
}

// ワークスペース削除（OWNER のみ、確認名の一致が必要）。削除後はワークスペース依存の
// キャッシュを広く無効化する。
export function useDeleteWorkspace(publicId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => deleteWorkspace(publicId, name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      qc.invalidateQueries({ queryKey: ["home"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["tags"] });
      qc.invalidateQueries({ queryKey: ["members"] });
    },
  });
}

// メイン画面の並べ替え。サーバ応答（新しい順序）で workspaces キャッシュを差し替える。
// order は publicId の配列。
export function useReorderWorkspaces() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: string[]) => reorderWorkspaces(order),
    onSuccess: (data) => {
      qc.setQueryData<{ workspaces: Workspace[] }>(["workspaces"], data);
    },
  });
}

// メンバー一覧・管理は現在のワークスペース（Context の publicId）を対象にする。
export function useMembers() {
  const ws = useWsPublicId();
  return useQuery({
    queryKey: ["members", ws],
    queryFn: () => fetchMembers(ws),
  });
}

export function useAddMember() {
  const ws = useWsPublicId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { username: string; role?: Role }) => addMember(ws, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", ws] });
      qc.invalidateQueries({ queryKey: ["workspaces"] }); // memberCount 変化
    },
  });
}

export function useUpdateMemberRole() {
  const ws = useWsPublicId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: Role }) =>
      updateMemberRole(ws, userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["members", ws] }),
  });
}

export function useRemoveMember() {
  const ws = useWsPublicId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) => removeMember(ws, userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["members", ws] });
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      // 削除メンバーの担当タスクが未割当に戻るため一覧も再取得
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
