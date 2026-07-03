import { defineConfig } from "vitest/config";

// API 統合テスト（supertest + 実 Postgres）用の設定。
// 単一のテスト DB を共有するため、ファイル並列を無効化して直列実行する
// （並列だと beforeEach の TRUNCATE が他ファイルのデータを壊すため）。
export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    hookTimeout: 30000,
    testTimeout: 30000,
  },
});
