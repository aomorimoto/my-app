import { Router } from "express";
import { prisma } from "../db";
import { requireMembership, requireRole } from "../domain/workspace";
import { generatePublicId } from "../domain/publicId";
import {
  workspaceCreateSchema,
  workspaceUpdateSchema,
  workspaceReorderSchema,
  workspaceDeleteSchema,
} from "./schemas";
import { HttpError } from "./http";

// ワークスペース自体の一覧・作成・並べ替え・更新・削除（非スコープ）。
// 露出する識別子は publicId（不透明）。内部の連番 id はクライアント/AI に返さない。
// メンバー管理は /api/w/:wsPublicId/members（src/api/members.ts）に分離した。
export const apiWorkspacesRouter = Router();

// publicId → 内部 id を解決する。未知なら 404。
async function resolveWorkspaceId(publicId: string): Promise<number> {
  const ws = await prisma.workspace.findUnique({ where: { publicId }, select: { id: true } });
  if (!ws) throw new HttpError(404, "ワークスペースが見つかりません。", "NOT_FOUND");
  return ws.id;
}

// 自分の所属ワークスペースを表示順（position → id）で取得して API 表現に整える。
async function listWorkspaces(userId: number) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    orderBy: [{ position: "asc" }, { id: "asc" }],
    select: {
      role: true,
      workspace: {
        select: {
          publicId: true,
          name: true,
          iconColor: true,
          iconImage: true,
          _count: { select: { members: true } },
        },
      },
    },
  });
  return memberships.map((m) => ({
    publicId: m.workspace.publicId,
    name: m.workspace.name,
    iconColor: m.workspace.iconColor,
    iconImage: m.workspace.iconImage,
    role: m.role,
    memberCount: m.workspace._count.members,
  }));
}

// 自分が所属するワークスペース一覧（表示順）
apiWorkspacesRouter.get("/", async (req, res) => {
  const workspaces = await listWorkspaces(req.userId!);
  res.json({ workspaces });
});

// ワークスペース作成（作成者が OWNER）。表示順は末尾に追加。publicId をアプリ側で採番。
apiWorkspacesRouter.post("/", async (req, res) => {
  const userId = req.userId!;
  const { name } = workspaceCreateSchema.parse(req.body);

  // 既存所属数を末尾 position として採用（メイン画面で新規WSを最後に並べる）
  const position = await prisma.membership.count({ where: { userId } });

  const workspace = await prisma.workspace.create({
    data: {
      publicId: generatePublicId(),
      name,
      ownerId: userId,
      members: { create: { userId, role: "OWNER", position } },
    },
    select: { publicId: true, name: true, iconColor: true, iconImage: true },
  });

  res.status(201).json({
    workspace: { ...workspace, role: "OWNER", memberCount: 1 },
  });
});

// メイン画面のワークスペース並べ替え（自分の Membership.position を publicId の配列順で更新）。
apiWorkspacesRouter.post("/reorder", async (req, res) => {
  const userId = req.userId!;
  const { order } = workspaceReorderSchema.parse(req.body);

  // 自分の所属を publicId → workspaceId に引くマップ（非所属/未知の publicId は無視される）。
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: { workspaceId: true, workspace: { select: { publicId: true } } },
  });
  const idByPublic = new Map(memberships.map((m) => [m.workspace.publicId, m.workspaceId]));

  await prisma.$transaction(
    order.map((publicId, index) =>
      prisma.membership.updateMany({
        where: { userId, workspaceId: idByPublic.get(publicId) ?? -1 },
        data: { position: index },
      })
    )
  );

  const workspaces = await listWorkspaces(userId);
  res.json({ workspaces });
});

// ワークスペースの更新（名前・アイコン）。OWNER / ADMIN のみ。
apiWorkspacesRouter.patch("/:publicId", async (req, res) => {
  const userId = req.userId!;
  const id = await resolveWorkspaceId(req.params.publicId);
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
      publicId: true,
      name: true,
      iconColor: true,
      iconImage: true,
      _count: { select: { members: true } },
    },
  });
  res.json({
    workspace: {
      publicId: workspace.publicId,
      name: workspace.name,
      iconColor: workspace.iconColor,
      iconImage: workspace.iconImage,
      role,
      memberCount: workspace._count.members,
    },
  });
});

// ワークスペース削除（OWNER のみ）。誤削除防止のため、確認用に入力された名前の一致を必須にする。
// 配下のタスク/タグ/エージェント/メンバー/コメントは FK の onDelete: Cascade で連鎖削除される。
apiWorkspacesRouter.delete("/:publicId", async (req, res) => {
  const userId = req.userId!;
  const id = await resolveWorkspaceId(req.params.publicId);
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
  res.status(204).end();
});
