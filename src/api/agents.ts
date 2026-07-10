import { Router } from "express";
import { prisma } from "../db";
import { resolveWorkspace } from "../domain/workspace";
import { agentCreateSchema, agentUpdateSchema } from "./schemas";
import { HttpError, parseId } from "./http";

export const apiAgentsRouter = Router();

// クライアント表現に整える（owner を軽量化）
function toAgent(a: {
  id: number;
  name: string;
  color: string;
  iconImage: string | null;
  workspaceId: number;
  ownerId: number | null;
  owner?: { id: number; username: string; name: string | null } | null;
  _count?: { assignedTasks: number };
}) {
  return {
    id: a.id,
    name: a.name,
    color: a.color,
    iconImage: a.iconImage ?? null,
    workspaceId: a.workspaceId,
    ownerId: a.ownerId,
    owner: a.owner ?? null,
    _count: a._count,
  };
}

// エージェント一覧（担当タスク件数付き）。閲覧はメンバー全員可。
apiAgentsRouter.get("/", async (req, res) => {
  const { workspaceId } = await resolveWorkspace(req);
  const agents = await prisma.agent.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
    include: {
      owner: { select: { id: true, username: true, name: true } },
      _count: { select: { assignedTasks: true } },
    },
  });
  res.json({ agents: agents.map(toAgent) });
});

// エージェント追加。メンバーなら誰でも自分用のエージェントを登録できる（owner = 本人）。
// WS 内で名前重複は 409。
apiAgentsRouter.post("/", async (req, res) => {
  const { workspaceId } = await resolveWorkspace(req);
  const userId = req.userId!;
  const { name, color, iconImage } = agentCreateSchema.parse(req.body);
  try {
    const agent = await prisma.agent.create({
      data: { name, color: color ?? "#6b7280", iconImage: iconImage ?? null, workspaceId, ownerId: userId },
      include: { owner: { select: { id: true, username: true, name: true } } },
    });
    res.status(201).json({ agent: toAgent(agent) });
  } catch (err: any) {
    if (err?.code === "P2002") {
      throw new HttpError(409, "同じ名前のエージェントが既に存在します。", "DUPLICATE_AGENT");
    }
    throw err;
  }
});

// エージェント編集（OWNER / ADMIN または本人が登録したもののみ）。名前重複は 409。
apiAgentsRouter.patch("/:id", async (req, res) => {
  const { workspaceId, role } = await resolveWorkspace(req);
  const userId = req.userId!;
  const id = parseId(req.params.id);
  const input = agentUpdateSchema.parse(req.body);

  const existing = await prisma.agent.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new HttpError(404, "エージェントが見つかりません。", "NOT_FOUND");
  const canManage = role === "OWNER" || role === "ADMIN" || existing.ownerId === userId;
  if (!canManage) throw new HttpError(403, "このエージェントを編集する権限がありません。", "FORBIDDEN");

  const data: any = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.color !== undefined) data.color = input.color;
  if (input.iconImage !== undefined) data.iconImage = input.iconImage;

  try {
    const agent = await prisma.agent.update({
      where: { id },
      data,
      include: { owner: { select: { id: true, username: true, name: true } } },
    });
    res.json({ agent: toAgent(agent) });
  } catch (err: any) {
    if (err?.code === "P2002") {
      throw new HttpError(409, "同じ名前のエージェントが既に存在します。", "DUPLICATE_AGENT");
    }
    throw err;
  }
});

// エージェント削除（OWNER / ADMIN または本人が登録したもののみ）。
// 担当タスクは onDelete: SetNull で未割当に戻る。
apiAgentsRouter.delete("/:id", async (req, res) => {
  const { workspaceId, role } = await resolveWorkspace(req);
  const userId = req.userId!;
  const id = parseId(req.params.id);

  const existing = await prisma.agent.findFirst({ where: { id, workspaceId } });
  if (!existing) throw new HttpError(404, "エージェントが見つかりません。", "NOT_FOUND");
  const canManage = role === "OWNER" || role === "ADMIN" || existing.ownerId === userId;
  if (!canManage) throw new HttpError(403, "このエージェントを削除する権限がありません。", "FORBIDDEN");

  await prisma.agent.delete({ where: { id } });
  res.status(204).end();
});
