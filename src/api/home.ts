import { Router } from "express";
import { prisma } from "../db";

// メイン画面（ホーム）用の横断ルータ。アクティブなワークスペースに限定せず、
// ログインユーザーが所属する「すべてのワークスペース」のタスクを統合して返す。
export const apiHomeRouter = Router();

// 集約ビューのタスク include（ダッシュボードと同等の軽量版）。
// どのワークスペースのタスクかを示すため workspace(id,name) を追加で含める。
const homeTaskInclude = {
  assignee: { select: { id: true, username: true, name: true, avatarColor: true, avatarImage: true } },
  assigneeAgent: { select: { id: true, name: true, color: true, iconImage: true } },
  taskTags: { include: { tag: true } },
  // 所属WSは publicId で示す（内部の連番 id は露出しない）。
  workspace: { select: { publicId: true, name: true, iconColor: true, iconImage: true } },
} as const;

// 兄弟内の並び順（tasks.ts と揃える）。
const SIBLING_ORDER = [{ position: "asc" as const }, { createdAt: "asc" as const }];
// 横断一覧で返すサブタスクツリーの深さ（tasks.ts の SUBTASK_DEPTH と揃える）。
const SUBTASK_DEPTH = 4;

// サブタスク1ノードの select（親と同じ表示情報＋担当者＋タグ＋件数）。
// depth > 0 のとき子（subtasks）も再帰的に含める。これにより横断一覧でも親子ツリーを保てる。
function homeSubtaskNode(depth: number): any {
  const select: any = {
    id: true,
    number: true,
    title: true,
    description: true,
    status: true,
    priority: true,
    dueDate: true,
    parentId: true,
    position: true,
    recurrenceRule: true,
    assigneeId: true,
    assigneeAgentId: true,
    createdAt: true,
    assignee: { select: { id: true, username: true, name: true, avatarColor: true, avatarImage: true } },
    assigneeAgent: { select: { id: true, name: true, color: true, iconImage: true } },
    taskTags: { include: { tag: true } },
    _count: { select: { comments: true, subtasks: true } },
  };
  if (depth > 0) {
    select.subtasks = { select: homeSubtaskNode(depth - 1), orderBy: SIBLING_ORDER };
  }
  return select;
}

// 横断タスク一覧（カレンダー / MCP list_all_tasks）用の include。
// homeTaskInclude にサブタスクツリーと件数を足し、親子構造を明示できるようにする。
const homeTaskTreeInclude = {
  ...homeTaskInclude,
  subtasks: { select: homeSubtaskNode(SUBTASK_DEPTH), orderBy: SIBLING_ORDER },
  _count: { select: { comments: true, subtasks: true } },
} as const;

// taskTags（中間テーブル）を tags: Tag[] に平坦化する（tasks.ts / dashboard.ts と同方針）。
// サブタスクツリーが含まれる場合は再帰的に平坦化する。
function shapeTask(task: any): any {
  const { taskTags, subtasks, ...rest } = task;
  return {
    ...rest,
    tags: (taskTags ?? []).map((tt: any) => tt.tag),
    ...(subtasks ? { subtasks: subtasks.map(shapeTask) } : {}),
  };
}

// 現在日の 0 時（UTC）。期限は日付のみ入力 → UTC 深夜で保存されるため、境界も UTC で取る。
function utcStartOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

const PRIORITY_RANK: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

// ログインユーザーが所属する全ワークスペースの id を返す
//（signup 時に個人ワークスペースが必ず作られるため、通常は最低 1 件ある）。
async function myWorkspaceIds(userId: number): Promise<number[]> {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { workspaceId: true },
  });
  return memberships.map((m) => m.workspaceId);
}

// メイン画面ダッシュボード：所属する全ワークスペースのトップレベル（親）タスクを横断集計する。
// 集計・並びのロジックはワークスペース単位の /api/dashboard と同一。
apiHomeRouter.get("/dashboard", async (req, res) => {
  const userId = req.userId!;
  const workspaceIds = await myWorkspaceIds(userId);

  const tasks = await prisma.task.findMany({
    where: { workspaceId: { in: workspaceIds }, parentId: null },
    include: homeTaskInclude,
    orderBy: { createdAt: "desc" },
  });

  const todayStart = utcStartOfToday();
  const tomorrowStart = addDays(todayStart, 1);
  const weekEnd = addDays(todayStart, 7);

  const byStatus = { TODO: 0, IN_PROGRESS: 0, DONE: 0 };
  let overdue = 0;
  let dueToday = 0;
  let dueThisWeek = 0; // 今日〜7日以内（超過は含めない）

  for (const t of tasks) {
    byStatus[t.status]++;
    if (t.status !== "DONE" && t.dueDate) {
      const due = t.dueDate;
      if (due < todayStart) overdue++;
      else if (due < tomorrowStart) dueToday++;
      if (due >= todayStart && due < weekEnd) dueThisWeek++;
    }
  }

  // 期限が設定された未完了タスクを期限昇順で（超過が先頭に来る）。
  const upcoming = tasks
    .filter((t) => t.status !== "DONE" && t.dueDate)
    .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
    .slice(0, 8)
    .map(shapeTask);

  // 自分が担当する未完了タスク。期限昇順（未設定は末尾）→ 優先度の順。
  const myTasks = tasks
    .filter((t) => t.status !== "DONE" && t.assigneeId === userId)
    .sort((a, b) => {
      const ad = a.dueDate ? a.dueDate.getTime() : Infinity;
      const bd = b.dueDate ? b.dueDate.getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
    })
    .slice(0, 8)
    .map(shapeTask);

  res.json({
    summary: { total: tasks.length, byStatus, overdue, dueToday, dueThisWeek },
    upcoming,
    myTasks,
  });
});

// メイン画面カレンダー / MCP list_all_tasks：所属する全ワークスペースのトップレベルタスクを返す。
// 各タスクの子は subtasks に入れ子で含む（親子ツリーを保つ）。表示側（CalendarGrid）は
// トップレベルのみを日付に配置し、MCP 側は入れ子構造からツリーを認識できる。
apiHomeRouter.get("/tasks", async (req, res) => {
  const userId = req.userId!;
  const workspaceIds = await myWorkspaceIds(userId);

  const tasks = await prisma.task.findMany({
    where: { workspaceId: { in: workspaceIds }, parentId: null },
    include: homeTaskTreeInclude,
    orderBy: { createdAt: "desc" },
  });

  res.json({ tasks: tasks.map(shapeTask) });
});
