import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTags, createTag, updateTag, deleteTag } from "../api/tags";
import { useWsPublicId } from "../lib/workspaceContext";

// タグは現在のワークスペース（Context の publicId）を対象にする。

export function useTags() {
  const ws = useWsPublicId();
  return useQuery({ queryKey: ["tags", ws], queryFn: () => fetchTags(ws) });
}

export function useCreateTag() {
  const ws = useWsPublicId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; color?: string }) => createTag(ws, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags", ws] }),
  });
}

export function useUpdateTag() {
  const ws = useWsPublicId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; name?: string; color?: string }) =>
      updateTag(ws, id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags", ws] });
      // タグ名/色の変更をタスクのバッジにも反映
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useDeleteTag() {
  const ws = useWsPublicId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTag(ws, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags", ws] });
      // タグ削除で紐づく TaskTag が消えるためタスク一覧も再取得
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
