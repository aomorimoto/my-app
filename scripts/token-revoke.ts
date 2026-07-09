import "dotenv/config";
import { parseArgs } from "node:util";
import { prisma, pool } from "../src/db";

// 個人アクセストークンを失効（削除）するスクリプト。
// 使い方: npm run token:revoke -- --id 3
//        npm run token:revoke -- --email me@example.com --label mcp
// id 指定が最優先。無ければ email + label で特定して削除する。

async function main() {
  const { values } = parseArgs({
    options: {
      id: { type: "string" },
      email: { type: "string" },
      label: { type: "string" },
    },
  });

  if (values.id) {
    const id = Number(values.id);
    if (!Number.isInteger(id) || id <= 0) {
      console.error("--id は正の整数で指定してください。");
      process.exitCode = 1;
      return;
    }
    const { count } = await prisma.personalAccessToken.deleteMany({ where: { id } });
    console.log(count > 0 ? `トークン #${id} を失効しました。` : `トークン #${id} は見つかりません。`);
    return;
  }

  const email = values.email?.trim().toLowerCase();
  const label = values.label?.trim();
  if (!email || !label) {
    console.error(
      "使い方: npm run token:revoke -- --id <n>  もしくは  --email <email> --label <label>"
    );
    process.exitCode = 1;
    return;
  }

  const { count } = await prisma.personalAccessToken.deleteMany({
    where: { label, user: { email } },
  });
  console.log(
    count > 0
      ? `${count} 件のトークン（${email} / ${label}）を失効しました。`
      : `該当するトークンが見つかりません（${email} / ${label}）。`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
