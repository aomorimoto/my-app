import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAgents, createAgent, updateAgent, deleteAgent } from "../api/agents";
import { useWsPublicId } from "../lib/workspaceContext";

// エージェントは現在のワークスペース（Context の publicId）を対象にする。

export function useAgents() {
  const ws = useWsPublicId();
  return useQuery({ queryKey: ["agents", ws], queryFn: () => fetchAgents(ws) });
}

export function useCreateAgent() {
  const ws = useWsPublicId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; color?: string; iconImage?: string | null }) =>
      createAgent(ws, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents", ws] }),
  });
}

export function useUpdateAgent() {
  const ws = useWsPublicId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...body
    }: {
      id: number;
      name?: string;
      color?: string;
      iconImage?: string | null;
    }) => updateAgent(ws, id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents", ws] });
      // 名前/色/アイコンの変更はタスク一覧・ダッシュボード（WS/横断）の担当表示にも反映される
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["home"] });
    },
  });
}

export function useDeleteAgent() {
  const ws = useWsPublicId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteAgent(ws, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents", ws] });
      // エージェント削除で担当タスクが未割当に戻るため一覧も再取得
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["home"] });
    },
  });
}
