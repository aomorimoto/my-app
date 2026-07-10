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
  workspace: { select: { id: true, name: true, iconColor: true, iconImage: true } },
} as const;

// taskTags（中間テーブル）を tags: Tag[] に平坦化する（tasks.ts / dashboard.ts と同方針）。
function shapeTask<T extends { taskTags: { tag: unknown }[] }>(task: T) {
  const { taskTags, ...rest } = task;
  return { ...rest, tags: taskTags.map((tt) => tt.tag) };
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

// メイン画面カレンダー：所属する全ワークスペースのトップレベルタスクを返す。
// 表示側（CalendarGrid）が期限のある日にチップとして配置する。
apiHomeRouter.get("/tasks", async (req, res) => {
  const userId = req.userId!;
  const workspaceIds = await myWorkspaceIds(userId);

  const tasks = await prisma.task.findMany({
    where: { workspaceId: { in: workspaceIds }, parentId: null },
    include: homeTaskInclude,
    orderBy: { createdAt: "desc" },
  });

  res.json({ tasks: tasks.map(shapeTask) });
});
