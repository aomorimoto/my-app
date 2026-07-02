export type Status = "TODO" | "IN_PROGRESS" | "DONE";
export type Priority = "HIGH" | "MEDIUM" | "LOW";

export type Role = "OWNER" | "ADMIN" | "MEMBER";

export interface User {
  id: number;
  email: string;
  name: string | null;
}

// アクティブなワークスペース（/api/auth/me が返す）
export interface ActiveWorkspace {
  id: number;
  name: string;
  role: Role;
}

// 自分が所属するワークスペース（/api/workspaces の要素）
export interface Workspace {
  id: number;
  name: string;
  ownerId: number;
  role: Role;
  memberCount: number;
}

// ワークスペースのメンバー（/api/workspaces/:id/members の要素）
export interface Member {
  id: number; // userId
  email: string;
  name: string | null;
  role: Role;
  joinedAt: string;
}

export interface Category {
  id: number;
  name: string;
  color: string;
  workspaceId: number;
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
  workspaceId: number;
  creatorId: number;
  assigneeId: number | null; // 担当者。UI 連携は Phase 3b
  assignee?: User | null;
  createdAt: string;
  updatedAt: string;
}

// タスク一覧の絞り込み・並び替え条件（URL クエリと 1:1）
export interface TaskFilters {
  status?: Status | "";
  priority?: Priority | "";
  category?: string; // カテゴリID（文字列）または ""
  assignee?: string; // 担当者のユーザーID（文字列）または ""
  sort?: "" | "dueDate" | "priority";
}
