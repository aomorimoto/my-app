import { Router } from "express";
import { prisma } from "../db";
import { resolveWorkspace, requireRole } from "../domain/workspace";
import { categoryCreateSchema } from "./schemas";
import { HttpError, parseId } from "./http";

export const apiCategoriesRouter = Router();

// カテゴリ一覧（タスク件数付き）。閲覧はメンバー全員可。
apiCategoriesRouter.get("/", async (req, res) => {
  const { workspaceId } = await resolveWorkspace(req);
  const categories = await prisma.category.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
    include: { _count: { select: { tasks: true } } },
  });
  res.json({ categories });
});

// カテゴリ追加（管理は OWNER / ADMIN のみ。design.md §6）
apiCategoriesRouter.post("/", async (req, res) => {
  const { workspaceId, role } = await resolveWorkspace(req);
  requireRole(role, ["OWNER", "ADMIN"]);
  const { name, color } = categoryCreateSchema.parse(req.body);
  const category = await prisma.category.create({
    data: { name, color: color ?? "#888888", workspaceId },
  });
  res.status(201).json({ category });
});

// カテゴリ削除（紐づくタスクは消さず categoryId が NULL になる）。OWNER / ADMIN のみ。
apiCategoriesRouter.delete("/:id", async (req, res) => {
  const { workspaceId, role } = await resolveWorkspace(req);
  requireRole(role, ["OWNER", "ADMIN"]);
  const id = parseId(req.params.id);
  const result = await prisma.category.deleteMany({ where: { id, workspaceId } });
  if (result.count === 0) throw new HttpError(404, "カテゴリが見つかりません。", "NOT_FOUND");
  res.status(204).end();
});
