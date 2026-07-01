// 新規登録時に自動作成する既定カテゴリ。
// EJS 版（src/routes/auth.ts）と API 版（src/api/auth.ts）で共有する。
export const DEFAULT_CATEGORIES = [
  { name: "仕事", color: "#2563eb" },
  { name: "個人", color: "#16a34a" },
];
