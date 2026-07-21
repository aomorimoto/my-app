import { Router } from "express";
import { authenticate, requireAuthApi } from "../middleware";
import { scopeWorkspace } from "../domain/workspace";
import { doubleCsrfProtection, generateCsrfToken } from "../security/csrf";
import { apiHealthRouter } from "./health";
import { apiAuthRouter } from "./auth";
import { apiUsersRouter } from "./users";
import { apiTasksRouter } from "./tasks";
import { apiAgentsRouter } from "./agents";
import { apiTagsRouter } from "./tags";
import { apiMembersRouter } from "./members";
import { apiWorkspacesRouter } from "./workspaces";
import { apiDashboardRouter } from "./dashboard";
import { apiHomeRouter } from "./home";
import { apiErrorHandler } from "./http";

// /api 配下の JSON API をまとめるルータ。
export const apiRouter = Router();

// ヘルスチェックは認証・CSRF 不要（死活監視用）
apiRouter.use("/health", apiHealthRouter);

// 認証情報の解決（session Cookie / Bearer トークン → req.userId）。CSRF より前に置く。
apiRouter.use(authenticate);

// CSRF トークン発行（認証不要・GET なので検証対象外）。
// クライアントはこれで得たトークンを X-CSRF-Token ヘッダで送る（ダブルサブミット）。
// overwrite=false・validateOnReuse=false: 有効な既存トークンは再利用し、別セッション由来で
// 無効になった Cookie が残っている場合（ログアウト→再ログインでセッションが変わった等）は
// throw せず新規発行する。これをしないと発行エンドポイント自体が 403 を返し、以後あらゆる
// 変更系リクエストが復旧不能になる。
apiRouter.get("/csrf", (req, res) => {
  res.json({ csrfToken: generateCsrfToken(req, res, false, false) });
});

// 認証（/me はログイン状態を返す）。login/signup/logout は CSRF 免除（ブートストラップのため）。
apiRouter.use("/auth", apiAuthRouter);

// ここから下（状態変更を伴うリソース系）は CSRF 保護対象。
// doubleCsrfProtection は GET/HEAD/OPTIONS を素通りするので一覧・詳細取得には影響しない。
// ただし Bearer トークン認証済み（Cookie を使わない＝CSRF 対象外）は免除する。
apiRouter.use((req, res, next) =>
  req.bearerAuth ? next() : doubleCsrfProtection(req, res, next)
);

// --- 横断・非スコープ（ログイン必須） ---
apiRouter.use("/users", requireAuthApi, apiUsersRouter);
// ワークスペース自体の一覧・作成・並べ替え・更新・削除（対象は body/:publicId で指定）
apiRouter.use("/workspaces", requireAuthApi, apiWorkspacesRouter);
// メイン画面（ホーム）用の横断ビュー（所属する全ワークスペースを統合）
apiRouter.use("/home", requireAuthApi, apiHomeRouter);

// --- ワークスペース・スコープ（/api/w/:wsPublicId/*） ---
// scopeWorkspace が URL の publicId → 対象WS＋役割を req.workspace に解決する（非所属は 403）。
// 配下のルータは resolveWorkspace(req) で対象WSを取得する（Phase 16: URL 駆動）。
const wsScopedRouter = Router();
wsScopedRouter.use("/tasks", apiTasksRouter);
wsScopedRouter.use("/dashboard", apiDashboardRouter);
wsScopedRouter.use("/agents", apiAgentsRouter);
wsScopedRouter.use("/tags", apiTagsRouter);
wsScopedRouter.use("/members", apiMembersRouter);
apiRouter.use("/w/:wsPublicId", requireAuthApi, scopeWorkspace, wsScopedRouter);

// 未定義の /api パスは JSON で 404
apiRouter.use((_req, res) => {
  res.status(404).json({ error: { message: "Not Found", code: "NOT_FOUND" } });
});

// 集約エラーハンドラ（このルータ内で発生したエラーを JSON に整形）。
apiRouter.use(apiErrorHandler);
