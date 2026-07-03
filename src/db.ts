import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// テスト/CI のローカル Postgres は SSL 非対応のことが多いため、DATABASE_SSL=false で無効化できる。
// 本番（Render）は未指定＝従来どおり SSL 有効のままにする。
const ssl = process.env.DATABASE_SSL === "false" ? false : { rejectUnauthorized: false };

// pg の接続プール。Prisma とセッションストア（connect-pg-simple）で共有する。
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl,
});

const adapter = new PrismaPg(pool);

// アプリ全体で 1 つだけ使い回す Prisma クライアント
export const prisma = new PrismaClient({ adapter });
