import { useQuery } from "@tanstack/react-query";
import { fetchHomeDashboard, fetchHomeTasks } from "../api/home";

// メイン画面の集約ダッシュボード（全ワークスペース横断）。
// メイン画面はダッシュボード/カレンダーを切り替えるため、表示中のビューだけ取得できるよう enabled を受ける。
export function useHomeDashboard(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["home", "dashboard"],
    queryFn: fetchHomeDashboard,
    enabled: options?.enabled ?? true,
  });
}

// メイン画面の集約カレンダー用タスク（全ワークスペース横断のトップレベルタスク）。
export function useHomeTasks(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["home", "tasks"],
    queryFn: fetchHomeTasks,
    enabled: options?.enabled ?? true,
  });
}
