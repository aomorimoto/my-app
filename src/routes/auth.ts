import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../db";
import { DEFAULT_CATEGORIES } from "../domain/defaults";

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN = 8;

// 新規登録フォーム
authRouter.get("/signup", (req, res) => {
  res.render("signup", { error: null, values: { email: "", name: "" } });
});

// 新規登録の実行
authRouter.post("/signup", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const name = String(req.body.name || "").trim();
  const password = String(req.body.password || "");

  const renderError = (message: string) =>
    res.status(400).render("signup", { error: message, values: { email, name } });

  if (!EMAIL_RE.test(email)) return renderError("メールアドレスの形式が正しくありません。");
  if (password.length < PASSWORD_MIN)
    return renderError(`パスワードは ${PASSWORD_MIN} 文字以上にしてください。`);

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return renderError("このメールアドレスは既に登録されています。");

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      name: name || null,
      password: hashed,
      categories: { create: DEFAULT_CATEGORIES },
    },
  });

  req.session.userId = user.id;
  res.redirect("/");
});

// ログインフォーム
authRouter.get("/login", (req, res) => {
  res.render("login", { error: null, values: { email: "" } });
});

// ログインの実行
authRouter.post("/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");

  const user = await prisma.user.findUnique({ where: { email } });
  // ユーザー有無に関わらず同じメッセージ（アカウント存在の漏洩を防ぐ）
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res
      .status(400)
      .render("login", { error: "メールアドレスまたはパスワードが違います。", values: { email } });
  }

  req.session.userId = user.id;
  res.redirect("/");
});

// ログアウト
authRouter.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/login");
  });
});
