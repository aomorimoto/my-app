import { doubleCsrf } from "csrf-csrf";
import type { Request } from "express";

// Render などのホスティングでは自動で本番フラグが立つ（app.ts と同じ判定）
const isProd = process.env.NODE_ENV === "production" || process.env.RENDER === "true";

// CSRF 用シークレット。専用の CSRF_SECRET があれば使い、無ければ SESSION_SECRET を流用する。
// （新しい必須 env を増やさないため。どちらも無ければリクエスト時に落とす）
function csrfSecret(): string {
  const secret = process.env.CSRF_SECRET ?? process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("環境変数 CSRF_SECRET / SESSION_SECRET のいずれも設定されていません。");
  }
  return secret;
}

// ダブルサブミットの「サブミット」側。クライアントは X-CSRF-Token ヘッダでトークンを返す。
const getTokenFromRequest = (req: Request) => req.headers["x-csrf-token"];

// csrf-csrf を構成する。
// バージョン差（v3 は generateToken/getTokenFromRequest、v4 は generateCsrfToken/getCsrfTokenFromRequest）を
// 吸収するため、設定は両系統のキーを渡し（余分なキーは無視される）、返り値も両名称を拾う。
const options = {
  getSecret: csrfSecret,
  // トークンはセッション単位に紐付ける。express-session は保存前でも sessionID を採番する。
  getSessionIdentifier: (req: Request) => req.sessionID,
  // __Host- 接頭辞は Secure 必須で http ローカル/テストで機能しないため、素の名前にする。
  cookieName: "x-csrf-token",
  cookieOptions: { sameSite: "lax" as const, secure: isProd, path: "/" },
  size: 64,
  getTokenFromRequest,
  getCsrfTokenFromRequest: getTokenFromRequest,
};

const csrf = doubleCsrf(options as Parameters<typeof doubleCsrf>[0]);

// GET/HEAD/OPTIONS は素通りし、POST/PATCH/DELETE のみ検証するミドルウェア。
// 検証失敗時は invalidCsrfTokenError を next() に渡す（http.ts の集約ハンドラで 403 に整形）。
export const doubleCsrfProtection = csrf.doubleCsrfProtection;

// トークン発行（Cookie をセットしつつ平文トークンを返す）。v3/v4 の名称差を吸収。
export const generateCsrfToken: (req: Request, res: unknown) => string =
  (csrf as any).generateCsrfToken ?? (csrf as any).generateToken;

// 不正トークン時に投げられるエラー（http.ts で参照して 403 に整形）。
export const invalidCsrfTokenError: Error = (csrf as any).invalidCsrfTokenError;
