import type { Request } from "express";
import { prisma } from "../db";
import { HttpError } from "../api/http";
import type { Role } from "../../generated/prisma/enums";

// リクエストユーザーの「アクティブなワークスペース」と、そこでの役割。
export interface ActiveWorkspace {
  workspaceId: number;
  role: Role;
}

// アクティブなワークスペースを解決する。
// session.workspaceId が本人の所属を指していればそれを採用。
// 無効/未設定なら最初の所属を既定にしてセッションへ保存する（Phase 3b で切替 UI を追加）。
// Bearer 認証（MCP 等）では Cookie セッションを持たないため、X-Workspace-Id ヘッダで
// 対象ワークスペースを明示指定できる（所属を厳格に検証し、非所属なら 403）。
// 未指定なら従来どおり先頭の所属を既定にする。
export async function resolveWorkspace(req: Request): Promise<ActiveWorkspace> {
  const userId = req.userId;
  // requireAuthApi 通過済みが前提だが、保険として
  if (!userId) throw new HttpError(401, "認証が必要です。", "UNAUTHENTICATED");

  // Bearer（MCP）からの明示指定: X-Workspace-Id ヘッダ。所属していなければ 403。
  // Web（Cookie）側は従来の session.workspaceId 解決を維持する（挙動不変）。
  if (req.bearerAuth) {
    const header = req.get("x-workspace-id");
    if (header !== undefined && header !== "") {
      const requestedId = Number(header);
      if (!Number.isInteger(requestedId) || requestedId <= 0) {
        throw new HttpError(400, "X-Workspace-Id が不正です。", "INVALID_WORKSPACE");
      }
      const explicit = await prisma.membership.findUnique({
        where: { userId_workspaceId: { userId, workspaceId: requestedId } },
      });
      if (!explicit) {
        throw new HttpError(
          403,
          "指定されたワークスペースにアクセスする権限がありません。",
          "FORBIDDEN"
        );
      }
      return { workspaceId: explicit.workspaceId, role: explicit.role };
    }
  }

  const wsId = req.session.workspaceId;
  let membership = wsId
    ? await prisma.membership.findUnique({
        where: { userId_workspaceId: { userId, workspaceId: wsId } },
      })
    : null;

  if (!membership) {
    // 最初の所属を既定に採用（登録時に個人ワークスペースが必ず作られる）
    membership = await prisma.membership.findFirst({
      where: { userId },
      orderBy: { id: "asc" },
    });
    if (!membership) {
      throw new HttpError(403, "所属するワークスペースがありません。", "NO_WORKSPACE");
    }
    // Bearer 認証時は session に書かない（Cookie を持たないので毎回この既定解決で十分。
    // 無駄なセッション行 / Set-Cookie を生まないため）。
    if (!req.bearerAuth) req.session.workspaceId = membership.workspaceId;
  }

  return { workspaceId: membership.workspaceId, role: membership.role };
}

// 役割による操作可否チェック。許可役割に含まれなければ 403（design.md §6）。
export function requireRole(role: Role, allowed: Role[]) {
  if (!allowed.includes(role)) {
    throw new HttpError(403, "この操作を行う権限がありません。", "FORBIDDEN");
  }
}

// 指定ワークスペースにおけるユーザーの役割を返す。所属していなければ 403。
// アクティブ WS ではなく URL で明示された :id を対象にするルート（メンバー管理）で使う。
export async function requireMembership(userId: number, workspaceId: number): Promise<Role> {
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
    select: { role: true },
  });
  if (!membership) {
    throw new HttpError(403, "このワークスペースにアクセスする権限がありません。", "FORBIDDEN");
  }
  return membership.role;
}
