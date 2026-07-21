import { useQuery } from "@tanstack/react-query";
import { fetchDashboard } from "../api/dashboard";
import { useOptionalWsPublicId } from "../lib/workspaceContext";

// ワークスペース単位のダッシュボード。
// メイン画面（集約ビュー）と同居して条件付きで使えるよう enabled を受ける。
// メイン画面（スコープ外）では ws が無いため、enabled と併せて自動的に無効化される。
export function useDashboard(options?: { enabled?: boolean }) {
  const ws = useOptionalWsPublicId();
  return useQuery({
    queryKey: ["dashboard", ws],
    queryFn: () => fetchDashboard(ws as string),
    enabled: (options?.enabled ?? true) && !!ws,
  });
}
