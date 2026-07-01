import type { Request, Response, NextFunction } from "express";
import { prisma } from "./db";

// express-session の型に userId を追加する
declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

// ログインユーザーを取得し、ビューから使えるよう res.locals.currentUser に載せる。
// セッションが残っていてもユーザーが消えている場合はセッションを破棄する。
export async function loadUser(req: Request, res: Response, next: NextFunction) {
  res.locals.currentUser = null;
  const userId = req.session.userId;
  if (userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true },
    });
    if (user) {
      res.locals.currentUser = user;
    } else {
      req.session.destroy(() => {});
    }
  }
  next();
}

// 未ログインなら /login へ。ログイン必須のルートで使う。
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  next();
}
