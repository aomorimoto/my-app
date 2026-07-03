import "dotenv/config";
import { createApp } from "./src/app";

// エントリポイント: アプリを組み立てて listen するだけ。
// アプリ本体の組み立ては src/app.ts の createApp() に集約している（テストから再利用するため）。
const app = createApp();
const PORT = process.env.PORT || 8888;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
