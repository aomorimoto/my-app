import "dotenv/config";
import { parseArgs } from "node:util";
import { prisma, pool } from "../src/db";

// 発行済みの個人アクセストークンを一覧するスクリプト。
// 使い方: npm run token:list            （全ユーザー分）
//        npm run token:list -- --email me@example.com  （特定ユーザー分）
// 平文・ハッシュは表示しない（id / label / user / 作成日時 / 最終利用日時のみ）。

async function main() {
  const { values } = parseArgs({
    options: { email: { type: "string" } },
  });
  const email = values.email?.trim().toLowerCase();

  const where = email ? { user: { email } } : {};
  const tokens = await prisma.personalAccessToken.findMany({
    where,
    orderBy: { id: "asc" },
    select: {
      id: true,
      label: true,
      createdAt: true,
      lastUsedAt: true,
      user: { select: { email: true } },
    },
  });

  if (tokens.length === 0) {
    console.log("トークンはありません。");
    return;
  }

  for (const t of tokens) {
    const last = t.lastUsedAt ? t.lastUsedAt.toISOString() : "（未使用）";
    console.log(
      `#${t.id}  ${t.user.email}  label=${t.label}  created=${t.createdAt.toISOString()}  lastUsed=${last}`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
