import { Router } from "express";
import { prisma } from "../db";
import { DEFAULT_CATEGORIES } from "../domain/defaults";
import { requireMembership, requireRole } from "../domain/workspace";
import { workspaceCreateSchema, memberAddSchema, memberRoleSchema } from "./schemas";
import { HttpError, parseId } from "./http";

export const apiWorkspacesRouter = Router();

// メンバー情報を API 表現に整える（user + role を平坦化）
function toMember(m: {
  role: string;
  joinedAt: Date;
  user: { id: number; email: string; name: string | null };
}) {
  return {
    id: m.user.id,
    email: m.user.email,
    name: m.user.name,
    role: m.role,
    joinedAt: m.joinedAt,
  };
}

// 自分が所属するワークスペース一覧
apiWorkspacesRouter.get("/", async (req, res) => {
  const userId = req.session.userId!;
  const memberships = await prisma.membership.findMany({
    where: { userId },
    orderBy: { id: "asc" },
    select: {
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          _count: { select: { members: true } },
        },
      },
    },
  });

  const workspaces = memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    ownerId: m.workspace.ownerId,
    role: m.role,
    memberCount: m.workspace._count.members,
  }));
  res.json({ workspaces });
});

// ワークスペース作成（作成者が OWNER。signup と同じく既定カテゴリを付与）
apiWorkspacesRouter.post("/", async (req, res) => {
  const userId = req.session.userId!;
  const { name } = workspaceCreateSchema.parse(req.body);

  const workspace = await prisma.workspace.create({
    data: {
      name,
      ownerId: userId,
      members: { create: { userId, role: "OWNER" } },
      categories: { create: DEFAULT_CATEGORIES },
    },
    select: { id: true, name: true, ownerId: true },
  });

  res.status(201).json({
    workspace: { ...workspace, role: "OWNER", memberCount: 1 },
  });
});

// アクティブなワークスペースを切り替える（所属を検証してセッションに保存）
apiWorkspacesRouter.post("/:id/activate", async (req, res) => {
  const userId = req.session.userId!;
  const id = parseId(req.params.id);
  const role = await requireMembership(userId, id);

  req.session.workspaceId = id;
  const ws = await prisma.workspace.findUnique({
    where: { id },
    select: { id: true, name: true },
  });
  res.json({ activeWorkspace: ws ? { id: ws.id, name: ws.name, role } : null });
});

// メンバー一覧（メンバーなら誰でも閲覧可）
apiWorkspacesRouter.get("/:id/members", async (req, res) => {
  const userId = req.session.userId!;
  const id = parseId(req.params.id);
  await requireMembership(userId, id);

  const members = await prisma.membership.findMany({
    where: { workspaceId: id },
    orderBy: { id: "asc" },
    select: {
      role: true,
      joinedAt: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });
  res.json({ members: members.map(toMember) });
});

// メンバー追加（メールで既存ユーザーを直接追加。OWNER / ADMIN のみ）
apiWorkspacesRouter.post("/:id/members", async (req, res) => {
  const userId = req.session.userId!;
  const id = parseId(req.params.id);
  const role = await requireMembership(userId, id);
  requireRole(role, ["OWNER", "ADMIN"]);
  const { email, role: newRole } = memberAddSchema.parse(req.body);

  const target = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });
  if (!target) {
    throw new HttpError(404, "そのメールアドレスのユーザーが見つかりません。", "USER_NOT_FOUND");
  }

  const existing = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: target.id, workspaceId: id } },
  });
  if (existing) throw new HttpError(409, "このユーザーは既にメンバーです。", "ALREADY_MEMBER");

  const membership = await prisma.membership.create({
    data: { userId: target.id, workspaceId: id, role: newRole ?? "MEMBER" },
    select: { role: true, joinedAt: true },
  });
  res.status(201).json({ member: toMember({ ...membership, user: target }) });
});

// 役割変更（OWNER / ADMIN のみ。OWNER の役割は不変）
apiWorkspacesRouter.patch("/:id/members/:userId", async (req, res) => {
  const actingUserId = req.session.userId!;
  const id = parseId(req.params.id);
  const targetUserId = parseId(req.params.userId);
  const role = await requireMembership(actingUserId, id);
  requireRole(role, ["OWNER", "ADMIN"]);
  const { role: newRole } = memberRoleSchema.parse(req.body);

  const target = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: targetUserId, workspaceId: id } },
    select: { role: true },
  });
  if (!target) throw new HttpError(404, "メンバーが見つかりません。", "NOT_FOUND");
  if (target.role === "OWNER") {
    throw new HttpError(403, "オーナーの役割は変更できません。", "FORBIDDEN");
  }

  const updated = await prisma.membership.update({
    where: { userId_workspaceId: { userId: targetUserId, workspaceId: id } },
    data: { role: newRole },
    select: {
      role: true,
      joinedAt: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });
  res.json({ member: toMember(updated) });
});

// メンバー削除（OWNER / ADMIN のみ。OWNER は削除不可。担当タスクは未割当に戻す）
apiWorkspacesRouter.delete("/:id/members/:userId", async (req, res) => {
  const actingUserId = req.session.userId!;
  const id = parseId(req.params.id);
  const targetUserId = parseId(req.params.userId);
  const role = await requireMembership(actingUserId, id);
  requireRole(role, ["OWNER", "ADMIN"]);

  const target = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: targetUserId, workspaceId: id } },
    select: { role: true },
  });
  if (!target) throw new HttpError(404, "メンバーが見つかりません。", "NOT_FOUND");
  if (target.role === "OWNER") throw new HttpError(403, "オーナーは削除できません。", "FORBIDDEN");

  // 担当タスクを未割当に戻してから Membership を削除（assignee FK は User 参照のため明示的に）
  await prisma.$transaction([
    prisma.task.updateMany({
      where: { workspaceId: id, assigneeId: targetUserId },
      data: { assigneeId: null },
    }),
    prisma.membership.delete({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId: id } },
    }),
  ]);
  res.status(204).end();
});
