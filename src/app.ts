import path from "node:path";
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

import { pool } from "./db";
import { apiRouter } from "./api/index";

// Render などのホスティングでは自動で本番フラグが立つ
const isProd = process.env.NODE_ENV === "production" || process.env.RENDER === "true";

// Express アプリを組み立てて返す（listen はしない）。
// 本番起動（index.ts）とテスト（supertest）の双方から同じ構成を再利用するため関数化している。
export function createApp() {
  const SESSION_SECRET = process.env.SESSION_SECRET;
  if (!SESSION_SECRET) {
    throw new Error("環境変数 SESSION_SECRET が設定されていません。");
  }

  const app = express();

  // 本番（Render）はプロキシ配下なので secure cookie を効かせるために必要
  if (isProd) app.set("trust proxy", 1);

  // JSON リクエストボディ（/api 用）
  app.use(express.json());

  // セッション（Postgres に保存）
  const PgSession = connectPgSimple(session);
  app.use(
    session({
      store: new PgSession({ pool, tableName: "session", createTableIfMissing: false }),
      secret: SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: isProd,
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 日
      },
    })
  );

  // JSON API（バックエンド層）。内部に 404 ハンドラを持つので /api/* は下の SPA fallback に落ちない
  app.use("/api", apiRouter);

  // React SPA（フロントエンド層）のビルド成果物を配信
  const clientDist = path.resolve("client/dist");
  app.use(express.static(clientDist));

  // SPA フォールバック: /api 以外の GET は index.html を返す
  // （Express 5 は path-to-regexp v8 で app.get("*") が使えないため最終ミドルウェアで対応）
  app.use((req, res, next) => {
    if (req.method !== "GET") return next();
    res.sendFile(path.join(clientDist, "index.html"));
  });

  return app;
}
