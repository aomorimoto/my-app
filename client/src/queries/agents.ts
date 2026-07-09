import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchAgents, createAgent, updateAgent, deleteAgent } from "../api/agents";

export function useAgents() {
  return useQuery({ queryKey: ["agents"], queryFn: fetchAgents });
}

export function useCreateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createAgent,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export function useUpdateAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; name?: string; color?: string }) =>
      updateAgent(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      // 名前/色の変更はタスク一覧・ダッシュボードの担当表示にも反映される
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteAgent,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      // エージェント削除で担当タスクが未割当に戻るため一覧も再取得
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}
