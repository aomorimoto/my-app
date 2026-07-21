import { apiFetch } from "./client";
import type { DashboardData } from "../types";

// ワークスペース単位のダッシュボード（/api/w/:ws/dashboard）。
export const fetchDashboard = (ws: string) => apiFetch<DashboardData>(`/api/w/${ws}/dashboard`);
