import type { Status, Priority } from "./types";

export const STATUSES: Status[] = ["TODO", "IN_PROGRESS", "DONE"];
export const PRIORITIES: Priority[] = ["HIGH", "MEDIUM", "LOW"];

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
