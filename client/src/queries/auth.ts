import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMe, login, signup, logout } from "../api/auth";

// 現在ログイン中のユーザー（{ user: User | null }）
export function useMe() {
  return useQuery({ queryKey: ["me"], queryFn: fetchMe });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: (data) => {
      // 認証状態を即時反映（ProtectedRoute のリダイレクト防止）。
      // activeWorkspace は続く refetch（invalidate）で埋める。
      qc.setQueryData(["me"], { user: data.user, activeWorkspace: null });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: signup,
    onSuccess: (data) => {
      qc.setQueryData(["me"], { user: data.user, activeWorkspace: null });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSuccess: () => {
      // ログイン状態を消し、前ユーザーのキャッシュを破棄する
      qc.setQueryData(["me"], { user: null });
      qc.removeQueries({ queryKey: ["tasks"] });
      qc.removeQueries({ queryKey: ["agents"] });
      qc.removeQueries({ queryKey: ["tags"] });
      qc.removeQueries({ queryKey: ["dashboard"] });
      qc.removeQueries({ queryKey: ["workspaces"] });
      qc.removeQueries({ queryKey: ["members"] });
    },
  });
}
