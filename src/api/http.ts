import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

// API 用の HTTP エラー。status（HTTP ステータス）と code（機械可読な種別）を持ち、
// 集約エラーハンドラ（apiErrorHandler）で JSON に整形される。
export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = "ERROR") {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// /api 配下の集約エラーハンドラ。
// すべてのエラーを { error: { message, code } } の統一形式に整える。
// Express 5 は async ハンドラの reject を自動でここへ渡す。
export function apiErrorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  // zod のバリデーション失敗 → 400
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return res.status(400).json({
      error: { message: first?.message ?? "入力内容が正しくありません。", code: "VALIDATION" },
    });
  }

  // 明示的に投げた HTTP エラー
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { message: err.message, code: err.code } });
  }

  // 想定外のエラーはサーバログにのみ詳細を残し、レスポンスは汎用文言にする
  console.error("[api] 予期しないエラー:", err);
  res
    .status(500)
    .json({ error: { message: "サーバー内部エラーが発生しました。", code: "INTERNAL" } });
}

// URL の :id を正の整数に変換する。不正なら 404 とする。
export function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new HttpError(404, "リソースが見つかりません。", "NOT_FOUND");
  }
  return id;
}
