import { Router } from "express";
import { prisma } from "../db";

export const categoriesRouter = Router();

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

// カテゴリ管理ページ
categoriesRouter.get("/categories", async (req, res) => {
  const userId = req.session.userId!;
  const categories = await prisma.category.findMany({
    where: { userId },
    orderBy: { name: "asc" },
    include: { _count: { select: { tasks: true } } },
  });
  res.render("categories", { categories });
});

// カテゴリ追加
categoriesRouter.post("/categories", async (req, res) => {
  const userId = req.session.userId!;
  const name = String(req.body.name || "").trim();
  const rawColor = String(req.body.color || "").trim();
  const color = HEX_RE.test(rawColor) ? rawColor : "#888888";

  if (name) {
    await prisma.category.create({ data: { name, color, userId } });
  }
  res.redirect("/categories");
});

// カテゴリ削除（タスクは消さず categoryId が NULL になる）
categoriesRouter.post("/categories/:id/delete", async (req, res) => {
  const userId = req.session.userId!;
  const id = Number(req.params.id);
  await prisma.category.deleteMany({ where: { id, userId } });
  res.redirect("/categories");
});
