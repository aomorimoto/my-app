import type { Express, Request, Response, NextFunction } from "express";
import cors from "cors";
import {
  mcpAuthRouter,
  getOAuthProtectedResourceMetadataUrl,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { oauthProvider } from "./provider";
import { handleMcpPost, methodNotAllowed } from "./http";
import { mcpLimiter } from "../security/rateLimit";

// リモート MCP（Streamable HTTP + 自前 OAuth 2.1）を既存の Express アプリに載せる。
// createApp() から、session ミドルウェアの後・静的配信/SPA フォールバックの前に呼ぶ。
export function mountMcp(app: Express) {
  const base = process.env.PUBLIC_BASE_URL;
  if (!base) {
    throw new Error(
      "環境変数 PUBLIC_BASE_URL が設定されていません（例: http://localhost:8888 / 本番は Render の公開URL）。"
    );
  }
  const issuerUrl = new URL(base);
  const resourceServerUrl = new URL(base.replace(/\/+$/, "") + "/mcp");

  // helmet 既定の Cross-Origin-Resource-Policy: same-origin だと、ブラウザ系 MCP
  // クライアントが well-known / /mcp をクロスオリジンで読めない。該当パスだけ緩める。
  app.use(
    [
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-protected-resource",
      "/mcp",
    ],
    (_req: Request, res: Response, next: NextFunction) => {
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      next();
    }
  );

  // 認可サーバのメタデータ（RFC 8414）+ 保護リソースメタデータ（RFC 9728）+
  // /authorize /token /register(DCR) /revoke をルート直下に生やす。
  app.use(
    mcpAuthRouter({
      provider: oauthProvider,
      issuerUrl,
      resourceServerUrl,
      scopesSupported: ["taskapp"],
      resourceName: "taskapp",
    })
  );

  // MCP 本体（Bearer 保護）。CORS はブラウザ系クライアント/将来互換のため許可する。
  const mcpCors = cors({
    origin: true,
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Authorization", "Content-Type", "Mcp-Session-Id", "MCP-Protocol-Version"],
    exposedHeaders: ["Mcp-Session-Id", "WWW-Authenticate"],
  });

  app.post(
    "/mcp",
    mcpCors,
    mcpLimiter,
    requireBearerAuth({
      verifier: oauthProvider,
      // 401 の WWW-Authenticate に載せ、クライアントが PRM を発見できるようにする。
      resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceServerUrl),
    }),
    handleMcpPost
  );

  // ステートレスなので GET/DELETE は非対応。CORS プリフライトは cors が 204 を返す。
  app.get("/mcp", mcpCors, methodNotAllowed);
  app.delete("/mcp", mcpCors, methodNotAllowed);
  app.options("/mcp", mcpCors);
}
