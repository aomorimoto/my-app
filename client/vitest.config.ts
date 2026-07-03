import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// フロントエンドのテスト設定（vitest + React Testing Library）。
// 本番ビルド（vite.config.ts / `vite build`）とは分離し、ビルドが vitest に依存しないようにする。
// vitest は vitest.config.* を vite.config.* より優先して読み込む。
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
