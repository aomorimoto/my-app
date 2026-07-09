import { Router } from "express";
import { authenticate, requireAuthApi } from "../middleware";
import { doubleCsrfProtection, generateCsrfToken } from "../security/csrf";
import { apiHealthRouter } from "./health";
import { apiAuthRouter } from "./auth";
import { apiTasksRouter } from "./tasks";
import { apiCategoriesRouter } from "./categories";
import { apiTagsRouter } from "./tags";
import { apiWorkspacesRouter } from "./workspaces";
import { apiDashboardRouter } from "./dashboard";
import { apiErrorHandler } from "./http";

// /api 配下の JSON API をまとめるルータ。
export const apiRouter = Router();

// ヘルスチェックは認証・CSRF 不要（死活監視用）
apiRouter.use("/health", apiHealthRouter);

// 認証情報の解決（session Cookie / Bearer トークン → req.userId）。CSRF より前に置く。
apiRouter.use(authenticate);

// CSRF トークン発行（認証不要・GET なので検証対象外）。
// クライアントはこれで得たトークンを X-CSRF-Token ヘッダで送る（ダブルサブミット）。
apiRouter.get("/csrf", (req, res) => {
  res.json({ csrfToken: generateCsrfToken(req, res) });
});

// 認証（/me はログイン状態を返す）。login/signup/logout は CSRF 免除（ブートストラップのため）。
apiRouter.use("/auth", apiAuthRouter);

// ここから下（状態変更を伴うリソース系）は CSRF 保護対象。
// doubleCsrfProtection は GET/HEAD/OPTIONS を素通りするので一覧・詳細取得には影響しない。
// ただし Bearer トークン認証済み（Cookie を使わない＝CSRF 対象外）は免除する。
apiRouter.use((req, res, next) =>
  req.bearerAuth ? next() : doubleCsrfProtection(req, res, next)
);

// タスク・カテゴリ・ワークスペースはログイン必須（未ログインは JSON で 401）
apiRouter.use("/tasks", requireAuthApi, apiTasksRouter);
apiRouter.use("/categories", requireAuthApi, apiCategoriesRouter);
apiRouter.use("/tags", requireAuthApi, apiTagsRouter);
apiRouter.use("/workspaces", requireAuthApi, apiWorkspacesRouter);
apiRouter.use("/dashboard", requireAuthApi, apiDashboardRouter);

// 未定義の /api パスは JSON で 404
apiRouter.use((_req, res) => {
  res.status(404).json({ error: { message: "Not Found", code: "NOT_FOUND" } });
});

// 集約エラーハンドラ（このルータ内で発生したエラーを JSON に整形）。
apiRouter.use(apiErrorHandler);
