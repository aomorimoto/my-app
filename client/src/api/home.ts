import { apiFetch } from "./client";
import type { DashboardData, TasksResponse } from "../types";

// メイン画面（ホーム）の横断ビュー。所属する全ワークスペースを統合した結果を返す。
export const fetchHomeDashboard = () => apiFetch<DashboardData>("/api/home/dashboard");
export const fetchHomeTasks = () => apiFetch<TasksResponse>("/api/home/tasks");
