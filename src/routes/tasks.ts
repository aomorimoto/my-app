import { Router } from "express";
import { prisma } from "../db";

export const tasksRouter = Router();

const STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
const PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
type Status = (typeof STATUSES)[number];
type Priority = (typeof PRIORITIES)[number];

const isStatus = (v: unknown): v is Status => STATUSES.includes(v as Status);
const isPriority = (v: unknown): v is Priority => PRIORITIES.includes(v as Priority);

// フォームの入力をタスク用のデータに変換する。
// categoryId は本人のカテゴリのみ受け付ける（他人の id を弾く）。
async function buildTaskData(body: any, userId: number) {
  const title = String(body.title || "").trim();
  if (!title) return { error: "タイトルを入力してください。" as const };

  const description = String(body.description || "").trim() || null;
  const status: Status = isStatus(body.status) ? body.status : "TODO";
  const priority: Priority = isPriority(body.priority) ? body.priority : "MEDIUM";
  const dueDate = body.dueDate ? new Date(String(body.dueDate)) : null;

  let categoryId: number | null = null;
  if (body.categoryId) {
    const id = Number(body.categoryId);
    const owned = await prisma.category.findFirst({ where: { id, userId } });
    if (owned) categoryId = id;
  }

  return { data: { title, description, status, priority, dueDate, categoryId } };
}

// タスク一覧（絞り込み・並び替え付き）
tasksRouter.get(["/", "/tasks"], async (req, res) => {
  const userId = req.session.userId!;
  const { status, priority, category, sort } = req.query;

  // 絞り込み条件を組み立てる
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

  const [tasks, categories] = await Promise.all([
    prisma.task.findMany({ where, orderBy, include: { category: true } }),
    prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } }),
  ]);

  res.render("tasks/index", {
    tasks,
    categories,
    now: new Date(),
    filters: {
      status: isStatus(status) ? status : "",
      priority: isPriority(priority) ? priority : "",
      category: category ? String(category) : "",
      sort: typeof sort === "string" ? sort : "",
    },
  });
});

// タスク追加
tasksRouter.post("/tasks", async (req, res) => {
  const userId = req.session.userId!;
  const result = await buildTaskData(req.body, userId);
  if ("error" in result) return res.status(400).send(result.error);

  await prisma.task.create({ data: { ...result.data, userId } });
  res.redirect("/tasks");
});

// 編集フォーム
tasksRouter.get("/tasks/:id/edit", async (req, res) => {
  const userId = req.session.userId!;
  const id = Number(req.params.id);

  const [task, categories] = await Promise.all([
    prisma.task.findFirst({ where: { id, userId } }),
    prisma.category.findMany({ where: { userId }, orderBy: { name: "asc" } }),
  ]);
  if (!task) return res.status(404).redirect("/tasks");

  res.render("tasks/edit", { task, categories });
});

// タスク更新
tasksRouter.post("/tasks/:id", async (req, res) => {
  const userId = req.session.userId!;
  const id = Number(req.params.id);

  const result = await buildTaskData(req.body, userId);
  if ("error" in result) return res.status(400).send(result.error);

  // where に userId を含めることで他人のタスクは更新できない
  await prisma.task.updateMany({ where: { id, userId }, data: result.data });
  res.redirect("/tasks");
});

// 完了 / 未完了の切替
tasksRouter.post("/tasks/:id/toggle", async (req, res) => {
  const userId = req.session.userId!;
  const id = Number(req.params.id);

  const task = await prisma.task.findFirst({ where: { id, userId } });
  if (task) {
    await prisma.task.update({
      where: { id: task.id },
      data: { status: task.status === "DONE" ? "TODO" : "DONE" },
    });
  }
  // 絞り込み状態を保つため、元のページ（一覧）へ戻す。
  res.redirect(req.get("Referrer") || "/tasks");
});

// タスク削除
tasksRouter.post("/tasks/:id/delete", async (req, res) => {
  const userId = req.session.userId!;
  const id = Number(req.params.id);
  await prisma.task.deleteMany({ where: { id, userId } });
  res.redirect("/tasks");
});
