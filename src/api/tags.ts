import { Router } from "express";
import { prisma } from "../db";
import { resolveWorkspace, requireRole } from "../domain/workspace";
import { tagCreateSchema, tagUpdateSchema } from "./schemas";
import { HttpError, parseId } from "./http";

export const apiTagsRouter = Router();

// タグ一覧（付与タスク件数付き）。閲覧はメンバー全員可。
apiTagsRouter.get("/", async (req, res) => {
  const { workspaceId } = await resolveWorkspace(req);
  const tags = await prisma.tag.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
    include: { _count: { select: { taskTags: true } } },
  });
  res.json({ tags });
});

// タグ追加（管理は OWNER / ADMIN のみ。design.md §6）。WS 内で名前重複は 409。
apiTagsRouter.post("/", async (req, res) => {
  const { workspaceId, role } = await resolveWorkspace(req);
  requireRole(role, ["OWNER", "ADMIN"]);
  const { name, color } = tagCreateSchema.parse(req.body);
  try {
    const tag = await prisma.tag.create({
      data: { name, color: color ?? "#888888", workspaceId },
    });
    res.status(201).json({ tag });
  } catch (err: any) {
    if (err?.code === "P2002") {
      throw new HttpError(409, "同じ名前のタグが既に存在します。", "DUPLICATE_TAG");
    }
    throw err;
  }
});

// タグ編集（OWNER / ADMIN のみ）。名前重複は 409。
apiTagsRouter.patch("/:id", async (req, res) => {
  const { workspaceId, role } = await resolveWorkspace(req);
  requireRole(role, ["OWNER", "ADMIN"]);
  const id = parseId(req.params.id);
  const input = tagUpdateSchema.parse(req.body);

  const existing = await prisma.tag.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new HttpError(404, "タグが見つかりません。", "NOT_FOUND");

  const data: any = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.color !== undefined) data.color = input.color;

  try {
    const tag = await prisma.tag.update({ where: { id }, data });
    res.json({ tag });
  } catch (err: any) {
    if (err?.code === "P2002") {
      throw new HttpError(409, "同じ名前のタグが既に存在します。", "DUPLICATE_TAG");
    }
    throw err;
  }
});

// タグ削除（OWNER / ADMIN のみ）。紐づく TaskTag は cascade で削除される。
apiTagsRouter.delete("/:id", async (req, res) => {
  const { workspaceId, role } = await resolveWorkspace(req);
  requireRole(role, ["OWNER", "ADMIN"]);
  const id = parseId(req.params.id);
  const result = await prisma.tag.deleteMany({ where: { id, workspaceId } });
  if (result.count === 0) throw new HttpError(404, "タグが見つかりません。", "NOT_FOUND");
  res.status(204).end();
});
