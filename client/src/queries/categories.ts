import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCategories, createCategory, deleteCategory } from "../api/categories";

export function useCategories() {
  return useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCategory,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      // カテゴリ削除で紐づくタスクの categoryId が NULL になるため一覧も再取得
      qc.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
