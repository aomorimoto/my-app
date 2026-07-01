import { apiFetch } from "./client";
import type { User } from "../types";

export const fetchMe = () => apiFetch<{ user: User | null }>("/api/auth/me");

export const login = (body: { email: string; password: string }) =>
  apiFetch<{ user: User }>("/api/auth/login", { method: "POST", body });

export const signup = (body: { email: string; password: string; name?: string }) =>
  apiFetch<{ user: User }>("/api/auth/signup", { method: "POST", body });

export const logout = () => apiFetch<null>("/api/auth/logout", { method: "POST" });
