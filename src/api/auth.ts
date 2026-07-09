import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { DEFAULT_CATEGORIES } from "../domain/defaults";
import { resolveWorkspace } from "../domain/workspace";
import { signupSchema, loginSchema } from "./schemas";
import { HttpError } from "./http";
import { authLimiter } from "../security/rateLimit";

export const apiAuthRouter = Router();

// クライアントに返すユーザー情報（パスワード等は含めない）
function publicUser(user: { id: number; email: string; name: string | null }) {
  return { id: user.id, email: user.email, name: user.name };
}

// 現在ログイン中のユーザーと、アクティブなワークスペース。
// 未ログインでも 200 で { user: null } を返す（SPA が認証状態を素直に確認できるように）。
apiAuthRouter.get("/me", async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.json({ user: null, activeWorkspace: null });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  if (!user) return res.json({ user: null, activeWorkspace: null });

  // アクティブなワークスペースを解決して名前も返す（3b の切替 UI で再利用）
  const { workspaceId, role } = await resolveWorkspace(req);
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true },
  });

  res.json({
    user: publicUser(user),
    activeWorkspace: ws ? { id: ws.id, name: ws.name, role } : null,
  });
});

// 新規登録：ユーザー + 個人ワークスペース + OWNER メンバーシップ + 既定カテゴリを一括作成
apiAuthRouter.post("/signup", authLimiter, async (req, res) => {
  const { email, password, name } = signupSchema.parse(req.body);

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    throw new HttpError(409, "このメールアドレスは既に登録されています。", "EMAIL_TAKEN");
  }

  const hashed = await bcrypt.hash(password, 10);

  // すべて成功するか、すべて失敗するか（データの整合性を担保）
  const { user, workspaceId } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, name: name || null, password: hashed },
      select: { id: true, email: true, name: true },
    });

    // 本人が OWNER となる個人ワークスペースを作成
    const workspace = await tx.workspace.create({
      data: {
        name: `${name || email}のワークスペース`,
        ownerId: user.id,
        members: { create: { userId: user.id, role: "OWNER" } },
        categories: { create: DEFAULT_CATEGORIES },
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
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  // ユーザー有無に関わらず同じメッセージ（アカウント存在の漏洩を防ぐ）
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new HttpError(401, "メールアドレスまたはパスワードが違います。", "INVALID_CREDENTIALS");
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
