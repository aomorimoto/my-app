import "dotenv/config";
import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";

import { pool } from "./src/db";
import { loadUser, requireAuth } from "./src/middleware";
import { authRouter } from "./src/routes/auth";
import { tasksRouter } from "./src/routes/tasks";
import { categoriesRouter } from "./src/routes/categories";

const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  throw new Error("環境変数 SESSION_SECRET が設定されていません。");
}

// Render などのホスティングでは自動で本番フラグが立つ
const isProd = process.env.NODE_ENV === "production" || process.env.RENDER === "true";

const app = express();
const PORT = process.env.PORT || 8888;

// EJS のテンプレート設定
app.set("view engine", "ejs");
app.set("views", "./views");

// 本番（Render）はプロキシ配下なので secure cookie を効かせるために必要
if (isProd) app.set("trust proxy", 1);

// 静的ファイル（CSS など）と、フォーム本体の受け取り
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

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

// ログインユーザーをビューに渡す
app.use(loadUser);

// 認証関連（ログイン不要）
app.use("/", authRouter);

// 以降はログイン必須
app.use("/", requireAuth, tasksRouter);
app.use("/", requireAuth, categoriesRouter);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
