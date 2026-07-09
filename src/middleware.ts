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

// 認証ミドルウェア。session Cookie か Authorization: Bearer <token> のどちらかから
// ユーザーを特定し、req.userId にセットする（design.md §8「既存 userId スコープに合流」）。
// - Cookie セッションがあればそれを優先（DB アクセス無し）。
// - 無ければ Bearer トークンをハッシュして PersonalAccessToken を照合。
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
      const pat = await prisma.personalAccessToken.findUnique({
        where: { tokenHash: hashToken(raw) },
        select: { id: true, userId: true },
      });
      if (pat) {
        req.userId = pat.userId;
        req.bearerAuth = true;
        // 最終利用日時を更新（失敗してもリクエストは続行）
        prisma.personalAccessToken
          .update({ where: { id: pat.id }, data: { lastUsedAt: new Date() } })
          .catch(() => {});
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
