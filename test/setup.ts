import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

// テストは必ず「使い捨てのテスト DB」に対して実行する。
// このプロジェクトのローカル .env は本番共有 DB を指すため、
// 誤って本番へ書き込まないよう多重にガードする。
//
// このファイルは vitest の setupFiles として、テスト本体（＝ src/db.ts を読み込む）より
// 先に実行される。ここで DATABASE_URL をテスト DB に差し替えてから db.ts を読ませる。

const rootDir = process.cwd();
const envTestPath = path.join(rootDir, ".env.test");
const envPath = path.join(rootDir, ".env");

// ローカルでは .env.test（テスト DB の接続情報）を必須にする。
// CI では .env / .env.test を置かず、環境変数を直接注入するのでファイルが無くても通す。
if (fs.existsSync(envTestPath)) {
  // override: true で、既に読み込まれている本番用 .env の DATABASE_URL を上書きする。
  // quiet: true で dotenv v17 の宣伝ログ（tips）を抑制する。
  dotenv.config({ path: envTestPath, override: true, quiet: true });
}

const testUrl = process.env.DATABASE_URL;
if (!testUrl) {
  throw new Error(
    "[test] DATABASE_URL が未設定です。使い捨てのテスト DB を .env.test に設定してください（本番 URL は使わない）。"
  );
}

// 本番（.env）の DATABASE_URL と一致していたら即中止する。
if (fs.existsSync(envPath)) {
  const prodUrl = dotenv.parse(fs.readFileSync(envPath)).DATABASE_URL;
  if (prodUrl && prodUrl === testUrl) {
    throw new Error(
      "[test] DATABASE_URL が本番（.env）と同一です。テストは本番と別の使い捨て DB を指してください。"
    );
  }
}

// テスト/CI 用の既定を補完（明示指定があればそれを優先）。
process.env.DATABASE_SSL = process.env.DATABASE_SSL ?? "false";
process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? "test-session-secret";
// createApp() は mountMcp() で PUBLIC_BASE_URL（OAuth issuer）を要求する。localhost は SDK が許可。
process.env.PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL ?? "http://localhost:8888";

// レート制限・morgan はテスト時に無効化する（NODE_ENV=test で判定）。
// テストは 10 回を超える signup を行うため、確実に "test" にしておく。
process.env.NODE_ENV = "test";
