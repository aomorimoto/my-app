import { Router } from "express";
import { prisma } from "../db";
import { categoryCreateSchema } from "./schemas";
import { HttpError, parseId } from "./http";

export const apiCategoriesRouter = Router();

// カテゴリ一覧（タスク件数付き）
apiCategoriesRouter.get("/", async (req, res) => {
  const userId = req.session.userId!;
  const categories = await prisma.category.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: { _count: { select: { tasks: true } } },
  });
  res.json({ categories });
});

// カテゴリ追加
apiCategoriesRouter.post("/", async (req, res) => {
  const userId = req.session.userId!;
  const { name, color } = categoryCreateSchema.parse(req.body);
  const category = await prisma.category.create({
    data: { name, color: color ?? "#888888", userId },
  });
  res.status(201).json({ category });
});

// カテゴリ削除（紐づくタスクは消さず categoryId が NULL になる）
apiCategoriesRouter.delete("/:id", async (req, res) => {
  const userId = req.session.userId!;
  const id = parseId(req.params.id);
  const result = await prisma.category.deleteMany({ where: { id, userId } });
  if (result.count === 0) throw new HttpError(404, "カテゴリが見つかりません。", "NOT_FOUND");
  res.status(204).end();
});
