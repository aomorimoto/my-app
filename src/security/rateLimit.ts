import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

// テスト環境ではレート制限を無効化する（多数の signup を行うためフレークになる）。
const skipInTest = () => process.env.NODE_ENV === "test";

// 429 も既存の統一エラー形式 { error: { message, code } } で返す。
function rateLimitHandler(_req: Request, res: Response) {
  res.status(429).json({
    error: {
      message: "リクエストが多すぎます。しばらくしてから再度お試しください。",
      code: "RATE_LIMITED",
    },
  });
}

const commonOptions = {
  standardHeaders: true, // RateLimit-* ヘッダを返す
  legacyHeaders: false, // 旧 X-RateLimit-* は無効
  handler: rateLimitHandler,
  skip: skipInTest,
};

// 認証系（ログイン/サインアップ）の厳しめ制限。総当たり・アカウント作成の乱発を緩和する。
export const authLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000, // 15 分
  limit: 10, // IP あたり 15 分で 10 回まで
});

// API 全体の緩めの制限（保険）。通常操作では到達しない上限にする。
export const apiLimiter = rateLimit({
  ...commonOptions,
  windowMs: 15 * 60 * 1000, // 15 分
  limit: 300, // IP あたり 15 分で 300 回まで
});
