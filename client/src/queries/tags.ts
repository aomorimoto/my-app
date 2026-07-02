import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTags, createTag, updateTag, deleteTag } from "../api/tags";

export function useTags() {
  return useQuery({ queryKey: ["tags"], queryFn: fetchTags });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createTag,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: number; name?: string; color?: string }) =>
      updateTag(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      // タグ名/色の変更をタスクのバッジにも反映
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteTag,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tags"] });
      // タグ削除で紐づく TaskTag が消えるためタスク一覧も再取得
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
