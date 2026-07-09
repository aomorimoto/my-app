import "dotenv/config";
import { parseArgs } from "node:util";
import { prisma, pool } from "../src/db";
import { generateToken } from "../src/domain/token";

// 個人アクセストークンを発行するスクリプト（MCP 等の Bearer 認証用）。
// 使い方: npm run token:create -- --email me@example.com --label mcp
// 平文トークンはこの発行時のみ表示される（DB にはハッシュのみ保存）。

async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      label: { type: "string" },
    },
  });

  const email = values.email?.trim().toLowerCase();
  const label = values.label?.trim();
  if (!email || !label) {
    console.error("使い方: npm run token:create -- --email <email> --label <label>");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    console.error(`ユーザーが見つかりません: ${email}`);
    process.exitCode = 1;
    return;
  }

  const { raw, hash } = generateToken();
  await prisma.personalAccessToken.create({
    data: { tokenHash: hash, userId: user.id, label },
  });

  console.log("個人アクセストークンを発行しました（この平文は再表示できません）:");
  console.log("");
  console.log(`  ${raw}`);
  console.log("");
  console.log(`email: ${email} / label: ${label}`);
  console.log("MCP クライアントの env（TASKAPP_TOKEN）に設定してください。コミットしないこと。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
