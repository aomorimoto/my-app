import type { ColorPrefs } from "./types";

// 状態/優先度/期限の既定表示色。styles.css の :root と一致させること
// （未設定のキーは CSS 側の既定値にフォールバックする）。
export const DEFAULT_COLORS: Required<ColorPrefs> = {
  statusTodo: "#64748b",
  statusInProgress: "#2563eb",
  statusDone: "#16a34a",
  prioHigh: "#dc2626",
  prioMedium: "#d97706",
  prioLow: "#16a34a",
  due: "#dc2626",
};

// colorPrefs のキー → CSS 変数名 → 表示ラベル。ThemeVars（適用）と設定 UI（編集）で共用する。
export const COLOR_FIELDS: { key: keyof ColorPrefs; cssVar: string; label: string }[] = [
  { key: "statusTodo", cssVar: "--status-todo", label: "状態: 未着手" },
  { key: "statusInProgress", cssVar: "--status-in_progress", label: "状態: 進行中" },
  { key: "statusDone", cssVar: "--status-done", label: "状態: 完了" },
  { key: "prioHigh", cssVar: "--high", label: "優先度: 高" },
  { key: "prioMedium", cssVar: "--medium", label: "優先度: 中" },
  { key: "prioLow", cssVar: "--low", label: "優先度: 低" },
  { key: "due", cssVar: "--due", label: "期限（超過・締切）" },
];
