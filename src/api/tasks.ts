import { Router } from "express";
import { prisma } from "../db";
import { taskCreateSchema, taskUpdateSchema } from "./schemas";
import { HttpError, parseId } from "./http";

export const apiTasksRouter = Router();

const STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
type Status = (typeof STATUSES)[number];
type Priority = (typeof PRIORITIES)[number];
const isStatus = (v: unknown): v is Status => STATUSES.includes(v as Status);
const isPriority = (v: unknown): v is Priority => PRIORITIES.includes(v as Priority);

// 指定カテゴリが本人所有か検証する。未所有・不明なら 400。
async function assertCategoryOwned(userId: number, categoryId: number) {
  const owned = await prisma.category.findFirst({ where: { id: categoryId, userId } });
  if (!owned) {
    throw new HttpError(400, "指定されたカテゴリが見つかりません。", "INVALID_CATEGORY");
  }
}

// タスク一覧（絞り込み・並び替え付き）
apiTasksRouter.get("/", async (req, res) => {
  const userId = req.session.userId!;
  const { status, priority, category, sort } = req.query;

  // 絞り込み条件を組み立てる（本人のタスクに限定）
  const where: any = { userId };
  if (isStatus(status)) where.status = status;
  if (isPriority(priority)) where.priority = priority;
  if (category && !Number.isNaN(Number(category))) where.categoryId = Number(category);

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

  const tasks = await prisma.task.findMany({ where, orderBy, include: { category: true } });
  res.json({ tasks });
});

// タスク作成
apiTasksRouter.post("/", async (req, res) => {
  const userId = req.session.userId!;
  const input = taskCreateSchema.parse(req.body);
  if (input.categoryId != null) await assertCategoryOwned(userId, input.categoryId);

  const task = await prisma.task.create({
    data: {
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "TODO",
      priority: input.priority ?? "MEDIUM",
      dueDate: input.dueDate ?? null,
      categoryId: input.categoryId ?? null,
      userId,
    },
    include: { category: true },
  });
  res.status(201).json({ task });
});

// タスク単一取得
apiTasksRouter.get("/:id", async (req, res) => {
  const userId = req.session.userId!;
  const id = parseId(req.params.id);
  const task = await prisma.task.findFirst({ where: { id, userId }, include: { category: true } });
  if (!task) throw new HttpError(404, "タスクが見つかりません。", "NOT_FOUND");
  res.json({ task });
});

// タスク更新（PATCH：送られてきた項目のみ更新）
apiTasksRouter.patch("/:id", async (req, res) => {
  const userId = req.session.userId!;
  const id = parseId(req.params.id);
  const input = taskUpdateSchema.parse(req.body);

  // 所有確認（他人のタスクは更新させない）
  const existing = await prisma.task.findFirst({ where: { id, userId } });
  if (!existing) throw new HttpError(404, "タスクが見つかりません。", "NOT_FOUND");

  if (input.categoryId != null) await assertCategoryOwned(userId, input.categoryId);

  // undefined（未送信）の項目は更新対象から外す
  const data: any = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.description !== undefined) data.description = input.description;
  if (input.status !== undefined) data.status = input.status;
  if (input.priority !== undefined) data.priority = input.priority;
  if (input.dueDate !== undefined) data.dueDate = input.dueDate;
  if (input.categoryId !== undefined) data.categoryId = input.categoryId;

  const task = await prisma.task.update({ where: { id }, data, include: { category: true } });
  res.json({ task });
});

// タスク削除
apiTasksRouter.delete("/:id", async (req, res) => {
  const userId = req.session.userId!;
  const id = parseId(req.params.id);
  const result = await prisma.task.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new HttpError(404, "タスクが見つかりません。", "NOT_FOUND");
  res.status(204).end();
});

// 完了 / 未完了の切替
apiTasksRouter.post("/:id/toggle", async (req, res) => {
  const userId = req.session.userId!;
  const id = parseId(req.params.id);

  const existing = await prisma.task.findFirst({ where: { id, userId } });
  if (!existing) throw new HttpError(404, "タスクが見つかりません。", "NOT_FOUND");

  const task = await prisma.task.update({
    where: { id },
    data: { status: existing.status === "DONE" ? "TODO" : "DONE" },
    include: { category: true },
  });
  res.json({ task });
});
