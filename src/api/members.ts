import { Router } from "express";
import { prisma } from "../db";
import { resolveWorkspace, requireRole } from "../domain/workspace";
import { memberAddSchema, memberRoleSchema } from "./schemas";
import { HttpError, parseId } from "./http";

// ワークスペース・スコープ配下のメンバー管理ルータ（/api/w/:wsPublicId/members）。
// 対象ワークスペースと役割は scopeWorkspace が解決済み（resolveWorkspace(req)）。
export const apiMembersRouter = Router();

// メンバー一覧で取得するユーザー select（アバター表示用の色/画像も含める）
const memberUserSelect = {
  id: true,
  username: true,
  name: true,
  avatarColor: true,
  avatarImage: true,
} as const;

// メンバー情報を API 表現に整える（user + role を平坦化）
function toMember(m: {
  role: string;
  joinedAt: Date;
  user: {
    id: number;
    username: string;
    name: string | null;
    avatarColor?: string | null;
    avatarImage?: string | null;
  };
}) {
  return {
    id: m.user.id,
    username: m.user.username,
    name: m.user.name,
    avatarColor: m.user.avatarColor ?? null,
    avatarImage: m.user.avatarImage ?? null,
    role: m.role,
    joinedAt: m.joinedAt,
  };
}

// メンバー一覧（メンバーなら誰でも閲覧可）
apiMembersRouter.get("/", async (req, res) => {
  const { workspaceId } = resolveWorkspace(req);
  const members = await prisma.membership.findMany({
    where: { workspaceId },
    orderBy: { id: "asc" },
    select: { role: true, joinedAt: true, user: { select: memberUserSelect } },
  });
  res.json({ members: members.map(toMember) });
});

// メンバー追加（ユーザーIDで既存ユーザーを直接追加。OWNER / ADMIN のみ）
apiMembersRouter.post("/", async (req, res) => {
  const { workspaceId, role } = resolveWorkspace(req);
  requireRole(role, ["OWNER", "ADMIN"]);
  const { username, role: newRole } = memberAddSchema.parse(req.body);

  const target = await prisma.user.findUnique({
    where: { username },
    select: memberUserSelect,
  });
  if (!target) {
    throw new HttpError(404, "そのユーザーIDのユーザーが見つかりません。", "USER_NOT_FOUND");
  }

  const existing = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: target.id, workspaceId } },
  });
  if (existing) throw new HttpError(409, "このユーザーは既にメンバーです。", "ALREADY_MEMBER");

  // 表示順（position）は末尾に追加する（追加ユーザーのメイン画面での並び順）。
  const position = await prisma.membership.count({ where: { userId: target.id } });
  const membership = await prisma.membership.create({
    data: { userId: target.id, workspaceId, role: newRole ?? "MEMBER", position },
    select: { role: true, joinedAt: true },
  });
  res.status(201).json({ member: toMember({ ...membership, user: target }) });
});

// 役割変更（OWNER / ADMIN のみ。OWNER の役割は不変）
apiMembersRouter.patch("/:userId", async (req, res) => {
  const { workspaceId, role } = resolveWorkspace(req);
  requireRole(role, ["OWNER", "ADMIN"]);
  const targetUserId = parseId(req.params.userId);
  const { role: newRole } = memberRoleSchema.parse(req.body);

  const target = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    select: { role: true },
  });
  if (!target) throw new HttpError(404, "メンバーが見つかりません。", "NOT_FOUND");
  if (target.role === "OWNER") {
    throw new HttpError(403, "オーナーの役割は変更できません。", "FORBIDDEN");
  }

  const updated = await prisma.membership.update({
    where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    data: { role: newRole },
    select: { role: true, joinedAt: true, user: { select: memberUserSelect } },
  });
  res.json({ member: toMember(updated) });
});

// メンバー削除（OWNER / ADMIN のみ。OWNER は削除不可。担当タスクは未割当に戻す）
apiMembersRouter.delete("/:userId", async (req, res) => {
  const { workspaceId, role } = resolveWorkspace(req);
  requireRole(role, ["OWNER", "ADMIN"]);
  const targetUserId = parseId(req.params.userId);

  const target = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    select: { role: true },
  });
  if (!target) throw new HttpError(404, "メンバーが見つかりません。", "NOT_FOUND");
  if (target.role === "OWNER") throw new HttpError(403, "オーナーは削除できません。", "FORBIDDEN");

  // 担当タスクを未割当に戻してから Membership を削除（assignee FK は User 参照のため明示的に）
  await prisma.$transaction([
    prisma.task.updateMany({
      where: { workspaceId, assigneeId: targetUserId },
      data: { assigneeId: null },
    }),
    prisma.membership.delete({
      where: { userId_workspaceId: { userId: targetUserId, workspaceId } },
    }),
  ]);
  res.status(204).end();
});
