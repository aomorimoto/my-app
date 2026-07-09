import { apiFetch } from "./client";
import type { Agent } from "../types";

export const fetchAgents = () => apiFetch<{ agents: Agent[] }>("/api/agents");

export const createAgent = (body: { name: string; color?: string }) =>
  apiFetch<{ agent: Agent }>("/api/agents", { method: "POST", body });

export const updateAgent = (id: number, body: { name?: string; color?: string }) =>
  apiFetch<{ agent: Agent }>(`/api/agents/${id}`, { method: "PATCH", body });

export const deleteAgent = (id: number) =>
  apiFetch<null>(`/api/agents/${id}`, { method: "DELETE" });
