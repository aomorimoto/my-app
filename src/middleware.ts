import type { Request, Response, NextFunction } from "express";
import { prisma } from "./db";
import { hashToken } from "./domain/token";

// express-session の型に userId と、選択中ワークスペース（workspaceId）を追加する
declare module "express-session" {
  interface SessionData {
    userId?: number;
    // 現在アクティブなワークスペース。未設定なら最初の所属を既定にして解決される。
    workspaceId?: number;
  }
}

// Express の Request に、認証で解決したユーザーIDと Bearer 認証フラグを持たせる。
// userId は「session Cookie もしくは有効な Bearer トークン」から解決した単一の真実源。
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: number;
      bearerAuth?: boolean; // Bearer トークンで認証されたリクエストか（CSRF 免除の判定に使う）
    }
  }
}

// 認証ミドルウェア。session Cookie か Authorization: Bearer <token>（リモート MCP の
// OAuth アクセストークン）のどちらかからユーザーを特定し、req.userId にセットする
// （design.md §8「既存 userId スコープに合流」）。
// - Cookie セッションがあればそれを優先（DB アクセス無し）。
// - 無ければ Bearer トークンをハッシュして OAuthAccessToken を照合（期限内のみ有効）。
//   これにより MCP ツールのループバック /api 呼び出しが既存の認可に合流する。
// - どちらも無ければ何もしない（後段の requireAuthApi が 401 を返す）。
// Bearer 認証時は req.session を書き換えない（無駄なセッション行を作らないため）。
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  if (req.session.userId) {
    req.userId = req.session.userId;
    return next();
  }

  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    const raw = header.slice("Bearer ".length).trim();
    if (raw) {
      const tokenHash = hashToken(raw);
      const at = await prisma.oAuthAccessToken.findUnique({
        where: { tokenHash },
        select: { userId: true, expiresAt: true },
      });
      if (at && at.expiresAt > new Date()) {
        req.userId = at.userId;
        req.bearerAuth = true;
      }
    }
  }

  next();
}

// API 用のログイン必須ミドルウェア。未認証は JSON で 401 を返す。
// authenticate が先に req.userId を解決している前提。
export function requireAuthApi(req: Request, res: Response, next: NextFunction) {
  if (!req.userId) {
    return res
      .status(401)
      .json({ error: { message: "認証が必要です。", code: "UNAUTHENTICATED" } });
  }
  next();
}
