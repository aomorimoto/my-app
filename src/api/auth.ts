import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { resolveWorkspace } from "../domain/workspace";
import { signupSchema, loginSchema } from "./schemas";
import { HttpError } from "./http";
import { authLimiter } from "../security/rateLimit";

export const apiAuthRouter = Router();

// クライアントに返すユーザー情報（パスワード等は含めない）
function publicUser(user: {
  id: number;
  username: string;
  name: string | null;
  avatarColor?: string | null;
  avatarImage?: string | null;
  colorPrefs?: unknown;
}) {
  return {
    id: user.id,
    username: user.username,
    name: user.name,
    avatarColor: user.avatarColor ?? null,
    avatarImage: user.avatarImage ?? null,
    colorPrefs: (user.colorPrefs as Record<string, string> | null) ?? null,
  };
}

// 現在ログイン中のユーザーと、アクティブなワークスペース。
// 未ログインでも 200 で { user: null } を返す（SPA が認証状態を素直に確認できるように）。
apiAuthRouter.get("/me", async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.json({ user: null, activeWorkspace: null });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      name: true,
      avatarColor: true,
      avatarImage: true,
      colorPrefs: true,
    },
  });
  if (!user) return res.json({ user: null, activeWorkspace: null });

  // アクティブなワークスペースを解決して名前・アイコンも返す（切替 UI／アイコン表示で再利用）
  const { workspaceId, role } = await resolveWorkspace(req);
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, iconColor: true, iconImage: true },
  });

  res.json({
    user: publicUser(user),
    activeWorkspace: ws
      ? {
          id: ws.id,
          name: ws.name,
          role,
          iconColor: ws.iconColor ?? null,
          iconImage: ws.iconImage ?? null,
        }
      : null,
  });
});

// 新規登録：ユーザー + 個人ワークスペース + OWNER メンバーシップを一括作成
apiAuthRouter.post("/signup", authLimiter, async (req, res) => {
  const { username, password, name } = signupSchema.parse(req.body);

  const exists = await prisma.user.findUnique({ where: { username } });
  if (exists) {
    throw new HttpError(409, "このユーザーIDは既に使われています。", "USERNAME_TAKEN");
  }

  const hashed = await bcrypt.hash(password, 10);

  // すべて成功するか、すべて失敗するか（データの整合性を担保）
  const { user, workspaceId } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { username, name: name || null, password: hashed },
      select: { id: true, username: true, name: true },
    });

    // 本人が OWNER となる個人ワークスペースを作成
    const workspace = await tx.workspace.create({
      data: {
        name: `${name || username}のワークスペース`,
        ownerId: user.id,
        members: { create: { userId: user.id, role: "OWNER" } },
      },
      select: { id: true },
    });

    return { user, workspaceId: workspace.id };
  });

  req.session.userId = user.id;
  req.session.workspaceId = workspaceId;
  res.status(201).json({ user: publicUser(user) });
});

// ログイン
apiAuthRouter.post("/login", authLimiter, async (req, res) => {
  const { username, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { username } });
  // ユーザー有無に関わらず同じメッセージ（アカウント存在の漏洩を防ぐ）
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new HttpError(401, "ユーザーIDまたはパスワードが違います。", "INVALID_CREDENTIALS");
  }

  req.session.userId = user.id;
  // 既定ワークスペース（最初の所属）を解決してセッションに保存
  const first = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { id: "asc" },
    select: { workspaceId: true },
  });
  req.session.workspaceId = first?.workspaceId;

  res.json({ user: publicUser(user) });
});

// ログアウト
apiAuthRouter.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.status(204).end();
  });
});
