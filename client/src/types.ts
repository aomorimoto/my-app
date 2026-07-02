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

// タグ（カテゴリと別軸で複数付与できる）
export interface Tag {
  id: number;
  name: string;
  color: string;
  workspaceId: number;
  _count?: { taskTags: number };
}

// タスクへのコメント
export interface Comment {
  id: number;
  body: string;
  taskId: number;
  authorId: number;
  author?: User;
  createdAt: string;
  updatedAt: string;
}

// 一覧・詳細の include に含まれるサブタスク（浅い表現）
export interface Subtask {
  id: number;
  title: string;
  status: Status;
  priority: Priority;
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
  parentId: number | null; // 親タスク（サブタスク時に設定）
  tags?: Tag[]; // API が taskTags を平坦化して返す
  subtasks?: Subtask[]; // 子タスク（浅い表現）
  _count?: { comments: number };
  createdAt: string;
  updatedAt: string;
}

// ダッシュボードのサマリ（/api/dashboard が返す）
export interface DashboardSummary {
  total: number;
  byStatus: Record<Status, number>;
  overdue: number; // 期限超過（未完了）
  dueToday: number; // 今日締切（未完了）
  dueThisWeek: number; // 今日〜7日以内（未完了・超過は含まない）
}

export interface DashboardData {
  summary: DashboardSummary;
  upcoming: Task[]; // 期限が近い/過ぎた未完了タスク（期限昇順）
  myTasks: Task[]; // 自分が担当する未完了タスク
}

// タスク一覧の絞り込み・並び替え条件（URL クエリと 1:1）
export interface TaskFilters {
  status?: Status | "";
  priority?: Priority | "";
  category?: string; // カテゴリID（文字列）または ""
  assignee?: string; // 担当者のユーザーID（文字列）または ""
  tag?: string; // タグID（文字列）または ""
  sort?: "" | "dueDate" | "priority";
  q?: string; // キーワード検索（タイトル/説明の部分一致）
  page?: number; // ページ番号（1始まり）。指定時のみサーバがページネーションする
}

// タスク一覧のレスポンス。ページネーション時のみ total 等が付く（未指定時は tasks のみ）。
export interface TasksResponse {
  tasks: Task[];
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}
