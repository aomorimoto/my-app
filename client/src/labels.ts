import type { Status, Priority, Role } from "./types";

export const STATUSES: Status[] = ["TODO", "IN_PROGRESS", "DONE"];
export const PRIORITIES: Priority[] = ["HIGH", "MEDIUM", "LOW"];

export const ROLE_LABEL: Record<Role, string> = {
  OWNER: "オーナー",
  ADMIN: "管理者",
  MEMBER: "メンバー",
};

// 担当者などの表示名（名前が無ければメール）
export function memberLabel(m: { name: string | null; email: string }): string {
  return m.name || m.email;
}

// 担当者セレクトは人間メンバーと AI エージェントを1つのドロップダウンで扱う。
// 結合値: "" = 未割当 / "u:<id>" = ユーザー / "a:<id>" = エージェント。
export function assigneeValue(t: {
  assigneeId: number | null;
  assigneeAgentId: number | null;
}): string {
  if (t.assigneeAgentId != null) return `a:${t.assigneeAgentId}`;
  if (t.assigneeId != null) return `u:${t.assigneeId}`;
  return "";
}

// 結合値を API 入力（assigneeId / assigneeAgentId）へ変換する。
export function parseAssignee(value: string): {
  assigneeId: number | null;
  assigneeAgentId: number | null;
} {
  if (value.startsWith("a:")) return { assigneeId: null, assigneeAgentId: Number(value.slice(2)) };
  if (value.startsWith("u:")) return { assigneeId: Number(value.slice(2)), assigneeAgentId: null };
  return { assigneeId: null, assigneeAgentId: null };
}

export const STATUS_LABEL: Record<Status, string> = {
  TODO: "未着手",
  IN_PROGRESS: "進行中",
  DONE: "完了",
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  HIGH: "高",
  MEDIUM: "中",
  LOW: "低",
};

// ISO 文字列を日本語の年月日表記に整形する
export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// ISO 文字列を日本語の日時表記に整形する（コメントのタイムスタンプ用）
export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
