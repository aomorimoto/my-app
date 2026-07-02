import { Router } from "express";
import { prisma } from "../db";
import { resolveWorkspace } from "../domain/workspace";
import { taskCreateSchema, taskUpdateSchema } from "./schemas";
import { HttpError, parseId } from "./http";
import { apiCommentsRouter } from "./comments";

export const apiTasksRouter = Router();

const STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
type Status = (typeof STATUSES)[number];
type Priority = (typeof PRIORITIES)[number];
const isStatus = (v: unknown): v is Status => STATUSES.includes(v as Status);
const isPriority = (v: unknown): v is Priority => PRIORITIES.includes(v as Priority);

// タスクレスポンス共通の include（カテゴリ＋担当者＋タグ＋サブタスク＋コメント件数）
const taskInclude = {
  category: true,
  assignee: { select: { id: true, email: true, name: true } },
  taskTags: { include: { tag: true } },
  subtasks: {
    select: { id: true, title: true, status: true, priority: true },
    orderBy: { createdAt: "asc" },
  },
  _count: { select: { comments: true } },
} as const;

// Prisma の taskTags（中間テーブル）をクライアント向けに tags: Tag[] へ平坦化する。
function shapeTask<T extends { taskTags: { tag: unknown }[] }>(task: T) {
  const { taskTags, ...rest } = task;
  return { ...rest, tags: taskTags.map((tt) => tt.tag) };
}

// 指定カテゴリが対象ワークスペースのものか検証する。異なる/不明なら 400。
async function assertCategoryInWorkspace(workspaceId: number, categoryId: number) {
  const found = await prisma.category.findFirst({ where: { id: categoryId, workspaceId } });
  if (!found) {
    throw new HttpError(400, "指定されたカテゴリが見つかりません。", "INVALID_CATEGORY");
  }
}

// 指定担当者が対象ワークスペースのメンバーか検証する。非メンバーなら 400。
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

// 指定タグ群がすべて対象ワークスペースのものか検証する。1つでも欠ければ 400。
async function assertTagsInWorkspace(workspaceId: number, tagIds: number[]) {
  if (tagIds.length === 0) return;
  const unique = [...new Set(tagIds)];
  const count = await prisma.tag.count({ where: { id: { in: unique }, workspaceId } });
  if (count !== unique.length) {
    throw new HttpError(400, "指定されたタグが見つかりません。", "INVALID_TAG");
  }
}

// 親タスクの妥当性を検証する（2階層のみ許可）。
// - 同一ワークスペースに存在すること
// - 自分自身を親にしないこと（selfId 指定時）
// - 親自身がサブタスクでないこと（parentId が null であること）
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
  if (parent.parentId != null) {
    throw new HttpError(
      400,
      "サブタスクをさらに親にすることはできません（2階層まで）。",
      "INVALID_PARENT"
    );
  }
  // 既に子を持つタスクは他タスクの子にできない（2階層を維持）
  if (selfId != null) {
    const childCount = await prisma.task.count({ where: { parentId: selfId } });
    if (childCount > 0) {
      throw new HttpError(
        400,
        "サブタスクを持つタスクは他タスクの子にできません。",
        "INVALID_PARENT"
      );
    }
  }
}

// 1ページあたりの件数（ページネーション有効時）
const PAGE_SIZE = 20;

// タスク一覧（絞り込み・キーワード検索・並び替え付き）。既定はトップレベル（親タスク）のみ。
// `page` クエリがある時だけページネーションを適用（無い時は従来どおり全件 `{ tasks }` を返す）。
apiTasksRouter.get("/", async (req, res) => {
  const { workspaceId } = await resolveWorkspace(req);
  const { status, priority, category, assignee, tag, sort } = req.query;

  // 絞り込み条件を組み立てる（ワークスペースのトップレベルタスクに限定）
  const where: any = { workspaceId, parentId: null };
  if (isStatus(status)) where.status = status;
  if (isPriority(priority)) where.priority = priority;
  if (category && !Number.isNaN(Number(category))) where.categoryId = Number(category);
  if (assignee && !Number.isNaN(Number(assignee))) where.assigneeId = Number(assignee);
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
      orderBy = [{ createdAt: "desc" }];
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
  const userId = req.session.userId!;
  const input = taskCreateSchema.parse(req.body);
  if (input.categoryId != null) await assertCategoryInWorkspace(workspaceId, input.categoryId);
  if (input.assigneeId != null) await assertAssigneeInWorkspace(workspaceId, input.assigneeId);
  if (input.parentId != null) await assertParentValid(workspaceId, input.parentId);
  if (input.tagIds) await assertTagsInWorkspace(workspaceId, input.tagIds);

  const task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "TODO",
      priority: input.priority ?? "MEDIUM",
      dueDate: input.dueDate ?? null,
      categoryId: input.categoryId ?? null,
      assigneeId: input.assigneeId ?? null,
      parentId: input.parentId ?? null,
      workspaceId,
      creatorId: userId,
      ...(input.tagIds && input.tagIds.length > 0
        ? { taskTags: { create: input.tagIds.map((tagId) => ({ tagId })) } }
        : {}),
    },
    include: taskInclude,
  });
  res.status(201).json({ task: shapeTask(task) });
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
  res.json({ task: shapeTask(task) });
});

// タスク更新（PATCH：送られてきた項目のみ更新）
apiTasksRouter.patch("/:id", async (req, res) => {
  const { workspaceId } = await resolveWorkspace(req);
  const id = parseId(req.params.id);
  const input = taskUpdateSchema.parse(req.body);

  // 対象ワークスペースのタスクか確認（他ワークスペースは更新させない）
  const existing = await prisma.task.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new HttpError(404, "タスクが見つかりません。", "NOT_FOUND");

  if (input.categoryId != null) await assertCategoryInWorkspace(workspaceId, input.categoryId);
  if (input.assigneeId != null) await assertAssigneeInWorkspace(workspaceId, input.assigneeId);
  if (input.parentId != null) await assertParentValid(workspaceId, input.parentId, id);
  if (input.tagIds) await assertTagsInWorkspace(workspaceId, input.tagIds);

  // undefined（未送信）の項目は更新対象から外す
  const data: any = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.status !== undefined) data.status = input.status;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.dueDate !== undefined) data.dueDate = input.dueDate;
  if (input.categoryId !== undefined) data.categoryId = input.categoryId;
  if (input.assigneeId !== undefined) data.assigneeId = input.assigneeId;
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

// 完了 / 未完了の切替
apiTasksRouter.post("/:id/toggle", async (req, res) => {
  const { workspaceId } = await resolveWorkspace(req);
  const id = parseId(req.params.id);

  const existing = await prisma.task.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new HttpError(404, "タスクが見つかりません。", "NOT_FOUND");

  const task = await prisma.task.update({
    where: { id },
    data: { status: existing.status === "DONE" ? "TODO" : "DONE" },
    include: taskInclude,
  });
  res.json({ task: shapeTask(task) });
});

// コメントはタスク配下にネスト（/api/tasks/:taskId/comments）
apiTasksRouter.use("/:taskId/comments", apiCommentsRouter);
