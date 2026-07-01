import type { Request, Response, NextFunction } from "express";

// express-session の型に userId を追加する
declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

// API 用のログイン必須ミドルウェア。未ログインは JSON で 401 を返す。
export function requireAuthApi(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res
      .status(401)
      .json({ error: { message: "認証が必要です。", code: "UNAUTHENTICATED" } });
  }
  next();
}
