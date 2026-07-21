import { apiFetch } from "./client";
import type { Agent } from "../types";

// AI エージェントはワークスペース・スコープ配下（/api/w/:ws/agents…）。
export const fetchAgents = (ws: string) => apiFetch<{ agents: Agent[] }>(`/api/w/${ws}/agents`);

export const createAgent = (
  ws: string,
  body: { name: string; color?: string; iconImage?: string | null }
) => apiFetch<{ agent: Agent }>(`/api/w/${ws}/agents`, { method: "POST", body });

export const updateAgent = (
  ws: string,
  id: number,
  body: { name?: string; color?: string; iconImage?: string | null }
) => apiFetch<{ agent: Agent }>(`/api/w/${ws}/agents/${id}`, { method: "PATCH", body });

export const deleteAgent = (ws: string, id: number) =>
  apiFetch<null>(`/api/w/${ws}/agents/${id}`, { method: "DELETE" });
