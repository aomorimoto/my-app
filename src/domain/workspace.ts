import type { Request, Response, NextFunction } from "express";
import { prisma } from "../db";
import { HttpError } from "../api/http";
import type { Role } from "../../generated/prisma/enums";

// リクエストが対象とするワークスペースと、そこでの役割。
export interface ActiveWorkspace {
  workspaceId: number;
  role: Role;
}

// URL の :wsPublicId から対象ワークスペースを解決するミドルウェア（Phase 16）。
// スコープ付きルータ（/api/w/:wsPublicId/*）の先頭に置き、publicId → 内部 id ＋所属役割を
// 解決して req.workspace にセットする。未知の publicId は 404、非所属は 403。
// Web（Cookie）でも Bearer（MCP）でも同じ経路で、req.userId さえ立っていればよい。
export async function scopeWorkspace(req: Request, _res: Response, next: NextFunction) {
  const userId = req.userId;
  // requireAuthApi 通過済みが前提だが、保険として
  if (!userId) throw new HttpError(401, "認証が必要です。", "UNAUTHENTICATED");

  const publicId = (req.params as { wsPublicId?: string }).wsPublicId;
  if (!publicId) throw new HttpError(400, "ワークスペースが指定されていません。", "NO_WORKSPACE");

  const ws = await prisma.workspace.findUnique({
    where: { publicId },
    select: { id: true },
  });
  if (!ws) throw new HttpError(404, "ワークスペースが見つかりません。", "WORKSPACE_NOT_FOUND");

  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId: ws.id } },
    select: { role: true },
  });
  if (!membership) {
    throw new HttpError(403, "このワークスペースにアクセスする権限がありません。", "FORBIDDEN");
  }

  req.workspace = { workspaceId: ws.id, role: membership.role };
  next();
}

// scopeWorkspace が解決した対象ワークスペースを返す。
// スコープ付きルータ配下のハンドラから呼ぶ（従来の呼び出し `await resolveWorkspace(req)` 互換）。
export function resolveWorkspace(req: Request): ActiveWorkspace {
  if (!req.workspace) {
    // scopeWorkspace を通っていないルートで呼ばれた場合（配線ミス）。
    throw new HttpError(500, "ワークスペースが解決されていません。", "NO_WORKSPACE_CONTEXT");
  }
  return req.workspace;
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
