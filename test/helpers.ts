import supertest from "supertest";
import { createApp } from "../src/app";
import { prisma, pool } from "../src/db";
import { generateToken } from "../src/domain/token";

// テスト対象の Express アプリ（listen しない）。全テストで再利用する。
// createApp() は setup.ts が DATABASE_URL / SESSION_SECRET を整えた後に呼ばれる。
export const app = createApp();

// 各テスト前に全テーブルを初期化する（自動採番も 1 から）。
// モデル名がそのままテーブル名（大文字始まり）なので二重引用符で囲む。session は @@map 済み。
export async function resetDb() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "Comment","TaskTag","Task","Tag","Agent","Membership","Workspace","PersonalAccessToken","User","session" RESTART IDENTITY CASCADE`
  );
}

// 接続を閉じる（各テストファイルの afterAll で呼び、プロセスが残らないようにする）。
export async function closeDb() {
  await pool.end().catch(() => {});
}

let counter = 0;

// signup 済みの認証エージェント（Cookie 保持）を作る。
// 返り値の agent を使えば、以降のリクエストはログイン状態で送られる。
// CSRF 保護が有効なので、agent の状態変更メソッド（post/put/patch/delete）は
// X-CSRF-Token ヘッダを自動付与するようラップする（既存テストを無改修にするため）。
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

  // ログイン済みセッションに紐づく CSRF トークンを取得し、以降の変更系に自動付与する。
  const csrfRes = await agent.get("/api/csrf");
  const token = csrfRes.body.csrfToken as string;
  for (const m of ["post", "put", "patch", "delete"] as const) {
    const orig = agent[m].bind(agent);
    (agent as any)[m] = (url: string) => orig(url).set("X-CSRF-Token", token);
  }

  return { agent, email, password, name, csrfToken: token, userId: res.body.user.id as number };
}

// 指定ユーザーの個人アクセストークンを発行し、平文を返す（Bearer 認証テスト用）。
export async function createToken(userId: number, label = "test") {
  const { raw, hash } = generateToken();
  await prisma.personalAccessToken.create({ data: { tokenHash: hash, userId, label } });
  return raw;
}
