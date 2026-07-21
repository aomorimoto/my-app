import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchComments,
  createComment,
  updateComment,
  deleteComment,
} from "../api/comments";
import { useWsPublicId } from "../lib/workspaceContext";

// コメントは現在のワークスペースのタスク（WS 内の連番 number）を対象にする。

export function useComments(number: number) {
  const ws = useWsPublicId();
  return useQuery({
    queryKey: ["comments", ws, number],
    queryFn: () => fetchComments(ws, number),
    enabled: Number.isFinite(number),
  });
}

export function useCreateComment(number: number) {
  const ws = useWsPublicId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => createComment(ws, number, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", ws, number] });
      // タスクのコメント件数バッジを更新
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useUpdateComment(number: number) {
  const ws = useWsPublicId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      updateComment(ws, number, id, { body }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["comments", ws, number] }),
  });
}

export function useDeleteComment(number: number) {
  const ws = useWsPublicId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteComment(ws, number, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["comments", ws, number] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
