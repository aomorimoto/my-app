import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchComments,
  createComment,
  updateComment,
  deleteComment,
} from "../api/comments";

export function useComments(taskId: number) {
  return useQuery({
    queryKey: ["comments", taskId],
    queryFn: () => fetchComments(taskId),
    enabled: Number.isFinite(taskId),
  });
}

export function useCreateComment(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => createComment(taskId, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", taskId] });
      // タスクのコメント件数バッジを更新
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useUpdateComment(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      updateComment(taskId, id, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", taskId] }),
  });
}

export function useDeleteComment(taskId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteComment(taskId, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", taskId] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
