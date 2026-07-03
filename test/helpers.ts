import supertest from "supertest";
import { createApp } from "../src/app";
import { prisma, pool } from "../src/db";

// テスト対象の Express アプリ（listen しない）。全テストで再利用する。
// createApp() は setup.ts が DATABASE_URL / SESSION_SECRET を整えた後に呼ばれる。
export const app = createApp();

// 各テスト前に全テーブルを初期化する（自動採番も 1 から）。
// モデル名がそのままテーブル名（大文字始まり）なので二重引用符で囲む。session は @@map 済み。
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "Comment","TaskTag","Task","Tag","Category","Membership","Workspace","User","session" RESTART IDENTITY CASCADE`
  );
}

// 接続を閉じる（各テストファイルの afterAll で呼び、プロセスが残らないようにする）。
export async function closeDb() {
  await pool.end().catch(() => {});
}

let counter = 0;

// signup 済みの認証エージェント（Cookie 保持）を作る。
// 返り値の agent を使えば、以降のリクエストはログイン状態で送られる。
export async function signupAgent(
  overrides: { email?: string; password?: string; name?: string } = {}
) {
  const email = overrides.email ?? `user${++counter}@example.com`;
  const password = overrides.password ?? "password123";
  const name = overrides.name ?? "テスト太郎";

  const agent = supertest.agent(app);
  const res = await agent.post("/api/auth/signup").send({ email, password, name });
  if (res.status !== 201) {
    throw new Error(`signup 失敗: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return { agent, email, password, name, userId: res.body.user.id as number };
}
