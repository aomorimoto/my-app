import { Router } from "express";
import { requireAuthApi } from "../middleware";
import { apiAuthRouter } from "./auth";
import { apiTasksRouter } from "./tasks";
import { apiCategoriesRouter } from "./categories";
import { apiErrorHandler } from "./http";

// /api 配下の JSON API をまとめるルータ。
// 既存の EJS 画面（サーバサイドレンダリング）とは独立して併存する。
export const apiRouter = Router();

// 認証は誰でもアクセス可（/me はログイン状態を返す）
apiRouter.use("/auth", apiAuthRouter);

// タスク・カテゴリはログイン必須（未ログインは JSON で 401）
apiRouter.use("/tasks", requireAuthApi, apiTasksRouter);
apiRouter.use("/categories", requireAuthApi, apiCategoriesRouter);

// 未定義の /api パスは JSON で 404
apiRouter.use((_req, res) => {
  res.status(404).json({ error: { message: "Not Found", code: "NOT_FOUND" } });
});

// 集約エラーハンドラ（このルータ内で発生したエラーを JSON に整形）。
// ルータ末尾に置くことで、EJS 側のエラー処理には影響を与えない。
apiRouter.use(apiErrorHandler);
