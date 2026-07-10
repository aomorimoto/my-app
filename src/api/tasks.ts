import { Router } from "express";
import { prisma } from "../db";
import { resolveWorkspace } from "../domain/workspace";
import { taskCreateSchema, taskUpdateSchema, taskReorderSchema } from "./schemas";
import { HttpError, parseId } from "./http";
import { apiCommentsRouter } from "./comments";
import { nextOccurrence } from "../domain/recurrence";

export const apiTasksRouter = Router();

const STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
type Status = (typeof STATUSES)[number];
type Priority = (typeof PRIORITIES)[number];
const isStatus = (v: unknown): v is Status => STATUSES.includes(v as Status);
const isPriority = (v: unknown): v is Priority => PRIORITIES.includes(v as Priority);

// サブタスクの兄弟内並び順。
const SIBLING_ORDER = [{ position: "asc" as const }, { createdAt: "asc" as const }];

// タスク一覧・詳細で返すサブタスクツリーの表示深さ（これより深い階層はクリックで開いて確認する）。
const SUBTASK_DEPTH = 4;

// サブタスク1ノードの select（表示に必要なフィールド＋担当者＋タグ＋件数）を作る。
// depth > 0 のときは子（subtasks）も再帰的に含める。
function subtaskNode(depth: number): any {
  const select: any = {
    id: true,
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
    assignee: { select: { id: true, email: true, name: true, avatarColor: true, avatarImage: true } },
    assigneeAgent: { select: { id: true, name: true, color: true, iconImage: true } },
    taskTags: { include: { tag: true } },
    _count: { select: { comments: true, subtasks: true } },
  };
  if (depth > 0) {
    select.subtasks = { select: subtaskNode(depth - 1), orderBy: SIBLING_ORDER };
  }
  return select;
}

// タスクレスポンス共通の include（担当者[人間/AI]＋タグ＋サブタスクツリー＋コメント件数）
const taskInclude = {
  assignee: { select: { id: true, email: true, name: true, avatarColor: true, avatarImage: true } },
  assigneeAgent: { select: { id: true, name: true, color: true, iconImage: true } },
  taskTags: { include: { tag: true } },
  subtasks: { select: subtaskNode(SUBTASK_DEPTH), orderBy: SIBLING_ORDER },
  _count: { select: { comments: true, subtasks: true } },
};

// Prisma の taskTags（中間テーブル）をクライアント向けに tags: Tag[] へ平坦化する。
// サブタスクツリーも同様に再帰的に平坦化する。
function shapeTask(task: any): any {
  const { taskTags, subtasks, ...rest } = task;
  return {
    ...rest,
    tags: (taskTags ?? []).map((tt: any) => tt.tag),
    ...(subtasks ? { subtasks: subtasks.map(shapeTask) } : {}),
  };
}

// 指定担当者（人間）が対象ワークスペースのメンバーか検証する。非メンバーなら 400。
async function assertAssigneeInWorkspace(workspaceId: number, assigneeId: number) {
  const member = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: assigneeId, workspaceId } },
  });
  if (!member) {
    throw new HttpError(
      400,
      "指定された担当者はこのワークスペースのメンバーではありません。",
      "INVALID_ASSIGNEE"
    );
  }
}

// 指定エージェントが対象ワークスペースのものか検証する。異なる/不明なら 400。
async function assertAgentInWorkspace(workspaceId: number, agentId: number) {
  const found = await prisma.agent.findFirst({ where: { id: agentId, workspaceId } });
  if (!found) {
    throw new HttpError(400, "指定されたエージェントが見つかりません。", "INVALID_AGENT");
  }
}

// 担当者はユーザーかエージェントのどちらか一方だけ。両方指定は 400。
function assertSingleAssignee(assigneeId?: number | null, assigneeAgentId?: number | null) {
  if (assigneeId != null && assigneeAgentId != null) {
    throw new HttpError(
      400,
      "担当者はユーザーかエージェントのどちらか一方だけ指定できます。",
      "ASSIGNEE_CONFLICT"
    );
  }
}

// 指定タグ群がすべて対象ワークスペースのものか検証する。1つでも欠ければ 400。
async function assertTagsInWorkspace(workspaceId: number, tagIds: number[]) {
  if (tagIds.length === 0) return;
  const unique = [...new Set(tagIds)];
  const count = await prisma.tag.count({ where: { id: { in: unique }, workspaceId } });
  if (count !== unique.length) {
    throw new HttpError(400, "指定されたタグが見つかりません。", "INVALID_TAG");
  }
}

// 親タスクの妥当性を検証する（多階層のネストを許可し、循環のみ禁止）。
// - 同一ワークスペースに存在すること
// - 自分自身を親にしないこと（selfId 指定時）
// - 自分の子孫を親にしないこと＝親の祖先チェーンに自分が現れないこと（循環防止）
async function assertParentValid(workspaceId: number, parentId: number, selfId?: number) {
  if (selfId != null && parentId === selfId) {
    throw new HttpError(400, "タスク自身を親に設定できません。", "INVALID_PARENT");
  }
  const parent = await prisma.task.findFirst({
    where: { id: parentId, workspaceId },
    select: { id: true, parentId: true },
  });
  if (!parent) {
    throw new HttpError(400, "指定された親タスクが見つかりません。", "INVALID_PARENT");
  }
  // 循環防止: 既存タスクの付け替え時は、新しい親の祖先を辿って自分が現れたら拒否する。
  if (selfId != null) {
    let cursor: number | null = parent.parentId;
    while (cursor != null) {
      if (cursor === selfId) {
        throw new HttpError(400, "サブタスクを循環させることはできません。", "INVALID_PARENT");
      }
      const up: { parentId: number | null } | null = await prisma.task.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = up?.parentId ?? null;
    }
  }
}

// 祖先チェーン（root → 直近の親）を返す。パンくず表示用。
// parentId を辿るだけの軽量クエリ（多階層でも通常は数段）。循環は seen で防御。
async function buildAncestors(
  workspaceId: number,
  parentId: number | null
): Promise<{ id: number; title: string }[]> {
  const chain: { id: number; title: string }[] = [];
  const seen = new Set<number>();
  let cursor: number | null = parentId;
  while (cursor != null && !seen.has(cursor)) {
    seen.add(cursor);
    const p: { id: number; title: string; parentId: number | null } | null =
      await prisma.task.findFirst({
        where: { id: cursor, workspaceId },
        select: { id: true, title: true, parentId: true },
      });
    if (!p) break;
    chain.push({ id: p.id, title: p.title });
    cursor = p.parentId;
  }
  return chain.reverse();
}

// 1ページあたりの件数（ページネーション有効時）
const PAGE_SIZE = 20;

// タスク一覧（絞り込み・キーワード検索・並び替え付き）。既定はトップレベル（親タスク）のみ。
// `page` クエリがある時だけページネーションを適用（無い時は従来どおり全件 `{ tasks }` を返す）。
apiTasksRouter.get("/", async (req, res) => {
  const { workspaceId } = await resolveWorkspace(req);
  const { status, priority, assignee, agent, tag, sort } = req.query;

  // 絞り込み条件を組み立てる（ワークスペースのトップレベルタスクに限定）
  const where: any = { workspaceId, parentId: null };
  if (isStatus(status)) where.status = status;
  if (isPriority(priority)) where.priority = priority;
  if (assignee && !Number.isNaN(Number(assignee))) where.assigneeId = Number(assignee);
  if (agent && !Number.isNaN(Number(agent))) where.assigneeAgentId = Number(agent);
  if (tag && !Number.isNaN(Number(tag))) where.taskTags = { some: { tagId: Number(tag) } };

  // キーワード検索（タイトル/説明の部分一致・大文字小文字無視）。他条件とは AND。
  const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
    ];
  }

  // 並び替え（既定は作成が新しい順）
  let orderBy: any;
  switch (sort) {
    case "dueDate":
      orderBy = [{ dueDate: { sort: "asc", nulls: "last" } }];
      break;
    case "priority":
      // enum 定義順が HIGH→MEDIUM→LOW なので asc で「高い順」になる
      orderBy = [{ priority: "asc" }, { createdAt: "desc" }];
      break;
    default:
      // 既定は手動並び順（D&D で設定した position）。同順位は作成が新しい順。
      orderBy = [{ position: "asc" }, { createdAt: "desc" }];
  }

  // ページネーション（opt-in）。`page` 未指定は全件返す（カレンダー等の既存呼び出し互換）。
  if (req.query.page !== undefined) {
    const page = Math.max(1, Number(req.query.page) || 1);
    const [rows, total] = await Promise.all([
      prisma.task.findMany({
        where,
        orderBy,
        include: taskInclude,
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.task.count({ where }),
    ]);
    res.json({
      tasks: rows.map(shapeTask),
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    });
    return;
  }

  const tasks = await prisma.task.findMany({ where, orderBy, include: taskInclude });
  res.json({ tasks: tasks.map(shapeTask) });
});

// タスク作成
apiTasksRouter.post("/", async (req, res) => {
  const { workspaceId } = await resolveWorkspace(req);
  const userId = req.userId!;
  const input = taskCreateSchema.parse(req.body);
  assertSingleAssignee(input.assigneeId, input.assigneeAgentId);
  if (input.assigneeId != null) await assertAssigneeInWorkspace(workspaceId, input.assigneeId);
  if (input.assigneeAgentId != null) await assertAgentInWorkspace(workspaceId, input.assigneeAgentId);
  if (input.parentId != null) await assertParentValid(workspaceId, input.parentId);
  if (input.tagIds) await assertTagsInWorkspace(workspaceId, input.tagIds);

  // サブタスク新規作成時は、明示指定の無いフィールド（未送信＝undefined）を親から継承する。
  // 状態・優先度・期限・担当者・タグの初期値を親タスクに合わせる（design.md §11）。
  let status = input.status ?? "TODO";
  let priority = input.priority ?? "MEDIUM";
  let dueDate = input.dueDate ?? null;
  let assigneeId = input.assigneeId ?? null;
  let assigneeAgentId = input.assigneeAgentId ?? null;
  let tagIds = input.tagIds;

  if (input.parentId != null) {
    const parent = await prisma.task.findFirst({
      where: { id: input.parentId, workspaceId },
      include: { taskTags: { select: { tagId: true } } },
    });
    if (parent) {
      if (input.status === undefined) status = parent.status;
      if (input.priority === undefined) priority = parent.priority;
      if (input.dueDate === undefined) dueDate = parent.dueDate;
      // 担当者はユーザー/エージェントのどちらも未指定のときだけ親から引き継ぐ。
      if (input.assigneeId === undefined && input.assigneeAgentId === undefined) {
        assigneeId = parent.assigneeId;
        assigneeAgentId = parent.assigneeAgentId;
      }
      if (input.tagIds === undefined) tagIds = parent.taskTags.map((tt) => tt.tagId);
    }
  }

  // 兄弟（同一WS・同一 parent）の末尾に配置する。
  const position = await prisma.task.count({
    where: { workspaceId, parentId: input.parentId ?? null },
  });

  const task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      status,
      priority,
      dueDate,
      assigneeId,
      assigneeAgentId,
      parentId: input.parentId ?? null,
      position,
      // 繰り返しは親からは継承しない（サブタスクは繰り返しインスタンスではない）。
      recurrenceRule: input.recurrenceRule ?? null,
      workspaceId,
      creatorId: userId,
      ...(tagIds && tagIds.length > 0
        ? { taskTags: { create: tagIds.map((tagId) => ({ tagId })) } }
        : {}),
    },
    include: taskInclude,
  });
  res.status(201).json({ task: shapeTask(task) });
});

// 兄弟内の並べ替え（D&D）。parentId が同じタスク群の position を配列順に更新する。
// parentId 省略 = トップレベル（null）。他WS・別 parent の id は 0 件マッチで無視される。
apiTasksRouter.post("/reorder", async (req, res) => {
  const { workspaceId } = await resolveWorkspace(req);
  const { parentId, order } = taskReorderSchema.parse(req.body);
  await prisma.$transaction(
    order.map((id, index) =>
      prisma.task.updateMany({
        where: { id, workspaceId, parentId: parentId ?? null },
        data: { position: index },
      })
    )
  );
  res.status(204).end();
});

// タスク単一取得
apiTasksRouter.get("/:id", async (req, res) => {
  const { workspaceId } = await resolveWorkspace(req);
  const id = parseId(req.params.id);
  const task = await prisma.task.findFirst({
    where: { id, workspaceId },
    include: taskInclude,
  });
  if (!task) throw new HttpError(404, "タスクが見つかりません。", "NOT_FOUND");
  // パンくず用に祖先チェーン（root → 親）を併せて返す。
  const ancestors = await buildAncestors(workspaceId, task.parentId);
  res.json({ task: { ...shapeTask(task), ancestors } });
});

// タスク更新（PATCH：送られてきた項目のみ更新）
apiTasksRouter.patch("/:id", async (req, res) => {
  const { workspaceId } = await resolveWorkspace(req);
  const id = parseId(req.params.id);
  const input = taskUpdateSchema.parse(req.body);

  // 対象ワークスペースのタスクか確認（他ワークスペースは更新させない）
  const existing = await prisma.task.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new HttpError(404, "タスクが見つかりません。", "NOT_FOUND");

  assertSingleAssignee(input.assigneeId, input.assigneeAgentId);
  if (input.assigneeId != null) await assertAssigneeInWorkspace(workspaceId, input.assigneeId);
  if (input.assigneeAgentId != null) await assertAgentInWorkspace(workspaceId, input.assigneeAgentId);
  if (input.parentId != null) await assertParentValid(workspaceId, input.parentId, id);
  if (input.tagIds) await assertTagsInWorkspace(workspaceId, input.tagIds);

  // undefined（未送信）の項目は更新対象から外す
  const data: any = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.status !== undefined) data.status = input.status;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.dueDate !== undefined) data.dueDate = input.dueDate;
  if (input.recurrenceRule !== undefined) data.recurrenceRule = input.recurrenceRule;
  // 担当者はユーザー/エージェントの相互排他。一方を割り当てたら他方を必ず外す。
  if (input.assigneeId !== undefined) {
    data.assigneeId = input.assigneeId;
    if (input.assigneeId != null) data.assigneeAgentId = null;
  }
  if (input.assigneeAgentId !== undefined) {
    data.assigneeAgentId = input.assigneeAgentId;
    if (input.assigneeAgentId != null) data.assigneeId = null;
  }
  if (input.parentId !== undefined) data.parentId = input.parentId;
  // tagIds が来たら全置き換え（既存の TaskTag を消してから作り直す）
  if (input.tagIds !== undefined) {
    data.taskTags = {
      deleteMany: {},
      create: input.tagIds.map((tagId) => ({ tagId })),
    };
  }

  const task = await prisma.task.update({ where: { id }, data, include: taskInclude });
  res.json({ task: shapeTask(task) });
});

// タスク削除
apiTasksRouter.delete("/:id", async (req, res) => {
  const { workspaceId } = await resolveWorkspace(req);
  const id = parseId(req.params.id);
  const result = await prisma.task.deleteMany({ where: { id, workspaceId } });
  if (result.count === 0) throw new HttpError(404, "タスクが見つかりません。", "NOT_FOUND");
  res.status(204).end();
});

// 完了 / 未完了の切替。
// 繰り返しタスクを「完了」にした瞬間は、そのタスクは完了のまま残し、次回分を1件生成する。
apiTasksRouter.post("/:id/toggle", async (req, res) => {
  const { workspaceId } = await resolveWorkspace(req);
  const id = parseId(req.params.id);

  const existing = await prisma.task.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new HttpError(404, "タスクが見つかりません。", "NOT_FOUND");

  const completing = existing.status !== "DONE"; // 未完了 → 完了 への遷移か
  const task = await prisma.task.update({
    where: { id },
    data: { status: completing ? "DONE" : "TODO" },
    include: taskInclude,
  });

  // 完了時のみ、繰り返し設定と期限がそろっていれば次回分を生成する。
  if (completing && existing.recurrenceRule && existing.dueDate) {
    const nextDue = nextOccurrence(existing.dueDate, existing.recurrenceRule);
    if (nextDue) {
      await regenerateRecurringTask(workspaceId, existing, nextDue);
    }
  }

  res.json({ task: shapeTask(task) });
});

// 完了した繰り返しタスクの複製を、次回の期限で新規作成する（TODO 状態）。
// タイトル/説明/優先度/担当者/タグ/繰り返しルールを引き継ぎ、生成元を recurrenceParentId に記録する。
// サブタスクは複製しない（設計 §繰り返し）。
async function regenerateRecurringTask(
  workspaceId: number,
  source: {
    id: number;
    title: string;
    description: string | null;
    priority: string;
    assigneeId: number | null;
    assigneeAgentId: number | null;
    parentId: number | null;
    creatorId: number;
    recurrenceRule: string | null;
  },
  nextDue: Date
) {
  const tags = await prisma.taskTag.findMany({
    where: { taskId: source.id },
    select: { tagId: true },
  });
  const position = await prisma.task.count({
    where: { workspaceId, parentId: source.parentId ?? null },
  });
  await prisma.task.create({
    data: {
      title: source.title,
      description: source.description,
      status: "TODO",
      priority: source.priority as any,
      dueDate: nextDue,
      assigneeId: source.assigneeId,
      assigneeAgentId: source.assigneeAgentId,
      parentId: source.parentId ?? null,
      position,
      recurrenceRule: source.recurrenceRule,
      recurrenceParentId: source.id,
      workspaceId,
      creatorId: source.creatorId,
      ...(tags.length > 0
        ? { taskTags: { create: tags.map((t) => ({ tagId: t.tagId })) } }
        : {}),
    },
  });
}

// コメントはタスク配下にネスト（/api/tasks/:taskId/comments）
apiTasksRouter.use("/:taskId/comments", apiCommentsRouter);
