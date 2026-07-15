import { apiFetch } from "./client";
import type { User, ActiveWorkspace, ColorPrefs } from "../types";

export interface MeResponse {
  user: User | null;
  activeWorkspace: ActiveWorkspace | null;
}

export const fetchMe = () => apiFetch<MeResponse>("/api/auth/me");

// 自分のプロフィール更新（ユーザーID・名前・アバター色/画像・表示色設定）。送る項目のみ更新。
export interface UpdateMeInput {
  username?: string;
  name?: string | null;
  avatarColor?: string | null;
  avatarImage?: string | null;
  colorPrefs?: ColorPrefs | null;
}

export const updateMe = (body: UpdateMeInput) =>
  apiFetch<{ user: User }>("/api/users/me", { method: "PATCH", body });

export const login = (body: { username: string; password: string }) =>
  apiFetch<{ user: User }>("/api/auth/login", { method: "POST", body });

export const signup = (body: { username: string; password: string; name?: string }) =>
  apiFetch<{ user: User }>("/api/auth/signup", { method: "POST", body });

export const logout = () => apiFetch<null>("/api/auth/logout", { method: "POST" });
