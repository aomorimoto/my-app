export type Status = "TODO" | "IN_PROGRESS" | "DONE";
export type Priority = "HIGH" | "MEDIUM" | "LOW";

export type Role = "OWNER" | "ADMIN" | "MEMBER";

// 状態/優先度/期限の表示色の個人設定（未設定キーは既定色にフォールバック）
export interface ColorPrefs {
  statusTodo?: string;
  statusInProgress?: string;
  statusDone?: string;
  prioHigh?: string;
  prioMedium?: string;
  prioLow?: string;
  due?: string;
}

export interface User {
  id: number;
  username: string;
  name: string | null;
  avatarColor?: string | null; // アバターの単色背景（未設定なら既定色）
  avatarImage?: string | null; // アバター画像（data URI。あれば色より優先）
  colorPrefs?: ColorPrefs | null;
}

// 自分が所属するワークスペース（/api/workspaces の要素）。
// Phase 16: 露出する識別子は publicId（不透明）のみ。内部の連番 id は返さない。
export interface Workspace {
  publicId: string;
  name: string;
  role: Role;
  memberCount: number;
  iconColor?: string | null;
  iconImage?: string | null;
}

// ワークスペースのメンバー（/api/w/:ws/members の要素）
export interface Member {
  id: number; // userId
  username: string;
  name: string | null;
  avatarColor?: string | null;
  avatarImage?: string | null;
  role: Role;
  joinedAt: string;
}

// AI エージェント（人間メンバーと同列に担当者へ指定できる）
export interface Agent {
  id: number;
  name: string;
  color: string;
  iconImage?: string | null; // アップロードしたアイコン画像（data URI。無ければ色＋🤖）
  workspaceId: number;
  ownerId: number | null;
  owner?: User | null;
  _count?: { assignedTasks: number };
}

// タグ（複数付与できる）
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

// 一覧・詳細の include に含まれるサブタスクツリーのノード。
// 親と同じ表示情報（説明・状態・優先度・期限・担当者・タグ）を持ち、子を再帰的に含む。
export interface TaskNode {
  id: number;
  number: number; // WS 内の連番（#1,#2…）。URL・表示に使う（内部 id は React キー等に留める）
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  parentId: number | null;
  position?: number;
  recurrenceRule?: string | null; // 繰り返しルール（RRULE 風。null=なし）
  assigneeId: number | null;
  assignee?: User | null;
  assigneeAgentId: number | null;
  assigneeAgent?: Pick<Agent, "id" | "name" | "color" | "iconImage"> | null;
  tags?: Tag[]; // API が taskTags を平坦化して返す
  subtasks?: TaskNode[]; // 子タスク（再帰）
  _count?: { comments: number; subtasks?: number };
  createdAt: string;
}

// JSON 経由なので日時は ISO 文字列で受け取る
export interface Task {
  id: number;
  number: number; // WS 内の連番（#1,#2…）。URL・表示に使う
  title: string;
  description: string | null;
  status: Status;
  priority: Priority;
  dueDate: string | null;
  workspaceId: number;
  creatorId: number;
  position?: number;
  // 担当者は「人間メンバー」または「AIエージェント」のどちらか一方
  assigneeId: number | null;
  assignee?: User | null;
  assigneeAgentId: number | null;
  assigneeAgent?: Pick<Agent, "id" | "name" | "color" | "iconImage"> | null;
  parentId: number | null; // 親タスク（サブタスク時に設定）
  recurrenceRule?: string | null; // 繰り返しルール（RRULE 風。null=なし）
  // 集約ビュー（メイン画面のダッシュボード/カレンダー）でのみ付与。どのWSのタスクかを示す。
  // 開くときは publicId ＋ number で URL を組み立てる（内部 id は露出しない）。
  workspace?: { publicId: string; name: string; iconColor?: string | null; iconImage?: string | null };
  tags?: Tag[]; // API が taskTags を平坦化して返す
  subtasks?: TaskNode[]; // 子タスクツリー（再帰）
  // パンくず用の祖先チェーン（root → 直近の親）。GET /api/w/:ws/tasks/:number でのみ付与。各要素は number。
  ancestors?: { number: number; title: string }[];
  _count?: { comments: number; subtasks?: number };
  createdAt: string;
  updatedAt: string;
}

// ダッシュボードのサマリ（/api/w/:ws/dashboard が返す）
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
  assignee?: string; // 担当ユーザーID（文字列）または ""
  agent?: string; // 担当エージェントID（文字列）または ""
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
