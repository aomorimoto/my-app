import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// pg の接続プール。Prisma とセッションストア（connect-pg-simple）で共有する。
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

const adapter = new PrismaPg(pool);

// アプリ全体で 1 つだけ使い回す Prisma クライアント
export const prisma = new PrismaClient({ adapter });
