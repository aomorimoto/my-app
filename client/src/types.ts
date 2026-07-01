export type Status = "TODO" | "IN_PROGRESS" | "DONE";
export type Priority = "HIGH" | "MEDIUM" | "LOW";

export interface User {
  id: number;
  email: string;
  name: string | null;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  userId: number;
  _count?: { tasks: number };
}

// JSON 経由なので日時は ISO 文字列で受け取る
export interface Task {
  id: number;
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  categoryId: number | null;
  category?: Category | null;
  userId: number;
  createdAt: string;
  updatedAt: string;
}

// タスク一覧の絞り込み・並び替え条件（URL クエリと 1:1）
export interface TaskFilters {
  status?: Status | "";
  priority?: Priority | "";
  category?: string; // カテゴリID（文字列）または ""
  sort?: "" | "dueDate" | "priority";
}
