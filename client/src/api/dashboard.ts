import { apiFetch } from "./client";
import type { DashboardData } from "../types";

export const fetchDashboard = () => apiFetch<DashboardData>("/api/dashboard");
