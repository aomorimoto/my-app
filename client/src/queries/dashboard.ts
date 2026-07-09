import { useQuery } from "@tanstack/react-query";
import { fetchDashboard } from "../api/dashboard";

// アクティブなワークスペース単位のダッシュボード。
// メイン画面（集約ビュー）と同居して条件付きで使えるよう enabled を受ける。
export function useDashboard(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: fetchDashboard,
    enabled: options?.enabled ?? true,
  });
}
