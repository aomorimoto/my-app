import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { DEFAULT_CATEGORIES } from "../domain/defaults";
import { signupSchema, loginSchema } from "./schemas";
import { HttpError } from "./http";

export const apiAuthRouter = Router();

// クライアントに返すユーザー情報（パスワード等は含めない）
function publicUser(user: { id: number; email: string; name: string | null }) {
  return { id: user.id, email: user.email, name: user.name };
}

// 現在ログイン中のユーザー。未ログインでも 200 で { user: null } を返す
// （SPA が認証状態を素直に確認できるように、あえて 401 にしない）。
apiAuthRouter.get("/me", async (req, res) => {
  const userId = req.session.userId;
  if (!userId) return res.json({ user: null });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true },
  });
  res.json({ user: user ? publicUser(user) : null });
});

// 新規登録
apiAuthRouter.post("/signup", async (req, res) => {
  const { email, password, name } = signupSchema.parse(req.body);

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    throw new HttpError(409, "このメールアドレスは既に登録されています。", "EMAIL_TAKEN");
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      password: hashed,
      categories: { create: DEFAULT_CATEGORIES },
    },
    select: { id: true, email: true, name: true },
  });

  req.session.userId = user.id;
  res.status(201).json({ user: publicUser(user) });
});

// ログイン
apiAuthRouter.post("/login", async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findUnique({ where: { email } });
  // ユーザー有無に関わらず同じメッセージ（アカウント存在の漏洩を防ぐ）
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw new HttpError(401, "メールアドレスまたはパスワードが違います。", "INVALID_CREDENTIALS");
  }

  req.session.userId = user.id;
  res.json({ user: publicUser(user) });
});

// ログアウト
apiAuthRouter.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.status(204).end();
  });
});
