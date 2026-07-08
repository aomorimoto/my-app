import { Router } from "express";
import { prisma } from "../db";

export const apiHealthRouter = Router();

// ヘルスチェック（認証・CSRF 不要）。
// デプロイ後の死活監視や Render の Health Check に使う。DB 疎通も確認する。
apiHealthRouter.get("/", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: "ok",
      db: "up",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: "error",
      db: "down",
      timestamp: new Date().toISOString(),
    });
  }
});
