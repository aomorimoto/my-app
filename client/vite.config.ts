import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// 開発時は Vite(:5173) から Express(:8888) へ /api をプロキシする。
// これによりブラウザからは同一オリジンに見え、セッション Cookie がそのまま通る。
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://localhost:8888",
    },
  },
  build: {
    outDir: "dist",
  },
});
