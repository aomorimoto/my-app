import { Router } from "express";
import { prisma } from "../db";
import { requireMembership, requireRole } from "../domain/workspace";
import {
  workspaceCreateSchema,
  workspaceUpdateSchema,
  workspaceReorderSchema,
  workspaceDeleteSchema,
  memberAddSchema,
  memberRoleSchema,
} from "./schemas";
import { HttpError, parseId } from "./http";

export const apiWorkspacesRouter = Router();

// 自分の所属ワークスペースを表示順（position → id）で取得して API 表現に整える。
// メイン画面の並べ替え結果（Membership.position）を反映する。
async function listWorkspaces(userId: number) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select: {
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          ownerId: true,
          iconColor: true,
          iconImage: true,
          _count: { select: { members: true } },
        },
      },
    },
  });
  return memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    ownerId: m.workspace.ownerId,
    iconColor: m.workspace.iconColor,
    iconImage: m.workspace.iconImage,
    role: m.role,
    memberCount: m.workspace._count.members,
  }));
}

// メンバー一覧で取得するユーザー select（アバター表示用の色/画像も含める）
const memberUserSelect = {
  id: true,
  email: true,
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
    email: string;
    name: string | null;
    avatarColor?: string | null;
    avatarImage?: string | null;
  };
}) {
  return {
    id: m.user.id,
    email: m.user.email,
    name: m.user.name,
    avatarColor: m.user.avatarColor ?? null,
    avatarImage: m.user.avatarImage ?? null,
    role: m.role,
    joinedAt: m.joinedAt,
  };
}

// 自分が所属するワークスペース一覧（表示順）
apiWorkspacesRouter.get("/", async (req, res) => {
  const workspaces = await listWorkspaces(req.userId!);
  res.json({ workspaces });
});

// ワークスペース作成（作成者が OWNER）。表示順は末尾に追加する。
apiWorkspacesRouter.post("/", async (req, res) => {
  const userId = req.userId!;
  const { name } = workspaceCreateSchema.parse(req.body);

  // 既存所属数を末尾 position として採用（メイン画面で新規WSを最後に並べる）
  const position = await prisma.membership.count({ where: { userId } });

  const workspace = await prisma.workspace.create({
    data: {
      name,
      ownerId: userId,
      members: { create: { userId, role: "OWNER", position } },
    },
    select: { id: true, name: true, ownerId: true, iconColor: true, iconImage: true },
  });

  res.status(201).json({
    workspace: { ...workspace, role: "OWNER", memberCount: 1 },
  });
});

// ワークスペースの更新（名前・アイコン）。OWNER / ADMIN のみ。
apiWorkspacesRouter.patch("/:id", async (req, res) => {
  const userId = req.userId!;
  const id = parseId(req.params.id);
  const role = await requireMembership(userId, id);
  requireRole(role, ["OWNER", "ADMIN"]);
  const input = workspaceUpdateSchema.parse(req.body);

  const data: Record<string, unknown> = {};
  if (input.name !== undefined) data.name = input.name;
  if (input.iconColor !== undefined) data.iconColor = input.iconColor;
  if (input.iconImage !== undefined) data.iconImage = input.iconImage;

  const workspace = await prisma.workspace.update({
    where: { id },
    data,
    select: {
      id: true,
      name: true,
      ownerId: true,
      iconColor: true,
      iconImage: true,
      _count: { select: { members: true } },
    },
  });
  res.json({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      ownerId: workspace.ownerId,
      iconColor: workspace.iconColor,
      iconImage: workspace.iconImage,
      role,
      memberCount: workspace._count.members,
    },
  });
});

// ワークスペース削除（OWNER のみ）。誤削除防止のため、確認用に入力された名前の一致を必須にする。
// 配下のタスク/タグ/エージェント/メンバー/コメントは FK の onDelete: Cascade で連鎖削除される。
apiWorkspacesRouter.delete("/:id", async (req, res) => {
  const userId = req.userId!;
  const id = parseId(req.params.id);
  const role = await requireMembership(userId, id);
  requireRole(role, ["OWNER"]);

  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!workspace) throw new HttpError(404, "ワークスペースが見つかりません。", "NOT_FOUND");

  // 確認入力（ワークスペース名）の一致を必須にして、誤操作による削除を防ぐ。
  const { name } = workspaceDeleteSchema.parse(req.body);
  if (name !== workspace.name) {
    throw new HttpError(400, "入力されたワークスペース名が一致しません。", "NAME_MISMATCH");
  }

  // 自分の所属がこれ1つだけの場合、削除するとどのワークスペースにも属さなくなり
  // アプリを操作できなくなるため禁止する（先に別のワークスペースを用意してもらう）。
  const membershipCount = await prisma.membership.count({ where: { userId } });
  if (membershipCount <= 1) {
    throw new HttpError(
      409,
      "最後のワークスペースは削除できません。先に別のワークスペースを作成してください。",
      "LAST_WORKSPACE"
    );
  }

  await prisma.workspace.delete({ where: { id } });

  // 削除したワークスペースがセッションのアクティブWSだった場合は選択を解除し、
  // 次回リクエストで別の所属ワークスペースへ再解決させる。
  if (req.session.workspaceId === id) {
    req.session.workspaceId = undefined;
  }

  res.status(204).end();
});

// メイン画面のワークスペース並べ替え（自分の Membership.position を配列順で更新）。
apiWorkspacesRouter.post("/reorder", async (req, res) => {
  const userId = req.userId!;
  const { order } = workspaceReorderSchema.parse(req.body);

  // 自分の所属分だけ position を配列の添字に更新（他人/非所属の id は 0 件マッチで無視）。
  await prisma.$transaction(
    order.map((workspaceId, index) =>
      prisma.membership.updateMany({
        where: { userId, workspaceId },
        data: { position: index },
      })
    )
  );

  const workspaces = await listWorkspaces(userId);
  res.json({ workspaces });
});

// アクティブなワークスペースを切り替える（所属を検証してセッションに保存）
apiWorkspacesRouter.post("/:id/activate", async (req, res) => {
  const userId = req.userId!;
  const id = parseId(req.params.id);
  const role = await requireMembership(userId, id);

  req.session.workspaceId = id;
  const ws = await prisma.workspace.findUnique({
    where: { id },
    select: { id: true, name: true, iconColor: true, iconImage: true },
  });
  res.json({
    activeWorkspace: ws
      ? { id: ws.id, name: ws.name, role, iconColor: ws.iconColor, iconImage: ws.iconImage }
      : null,
  });
});

// メンバー一覧（メンバーなら誰でも閲覧可）
apiWorkspacesRouter.get("/:id/members", async (req, res) => {
  const userId = req.userId!;
  const id = parseId(req.params.id);
  await requireMembership(userId, id);

  const members = await prisma.membership.findMany({
    where: { workspaceId: id },
    orderBy: { id: "asc" },
    select: {
      role: true,
      joinedAt: true,
      user: { select: memberUserSelect },
    },
  });
  res.json({ members: members.map(toMember) });
});

// メンバー追加（メールで既存ユーザーを直接追加。OWNER / ADMIN のみ）
apiWorkspacesRouter.post("/:id/members", async (req, res) => {
  const userId = req.userId!;
  const id = parseId(req.params.id);
  const role = await requireMembership(userId, id);
  requireRole(role, ["OWNER", "ADMIN"]);
  const { email, role: newRole } = memberAddSchema.parse(req.body);

  const target = await prisma.user.findUnique({
    where: { email },
    select: memberUserSelect,
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
  const actingUserId = req.userId!;
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
      user: { select: memberUserSelect },
    },
  });
  res.json({ member: toMember(updated) });
});

// メンバー削除（OWNER / ADMIN のみ。OWNER は削除不可。担当タスクは未割当に戻す）
apiWorkspacesRouter.delete("/:id/members/:userId", async (req, res) => {
  const actingUserId = req.userId!;
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
