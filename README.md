# タスク管理アプリ

Express（JSON API）+ React SPA + Prisma + PostgreSQL で作ったタスク管理アプリ。3層構造（フロントエンド / バックエンド / データベース）で構成し、GitHub → Render で公開する。

## 機能

- アカウント登録 / ログイン / ログアウト（セッション認証）
- タスクの追加・編集・削除・完了切替
- タスクの項目: タイトル / 説明 / 状態（未着手・進行中・完了）/ 優先度（高・中・低）/ 期限 / カテゴリ
- カテゴリの作成・削除（色付き）
- 状態・優先度・カテゴリでの絞り込み、期限・優先度・作成日での並び替え
- 期限切れタスクの強調表示
- データはユーザーごとに分離（本人のタスク・カテゴリのみ閲覧／操作可能）

## 技術スタック

- **フロントエンド**: React + TypeScript + Vite（SPA）/ React Router / TanStack Query
- **バックエンド**: Express 5（TypeScript / tsx / ESM）による JSON REST API（`/api/*`）/ zod バリデーション
- **DB / ORM**: PostgreSQL + Prisma 7（`@prisma/adapter-pg`）
- **認証**: express-session + connect-pg-simple（セッションを Postgres に保存）+ bcryptjs（同一オリジンの Cookie 認証）

## ディレクトリ構成

```
index.ts                 Express: /api マウント + React ビルド(client/dist)の配信 + SPA fallback
src/db.ts                pg Pool と Prisma クライアント（共有）
src/middleware.ts        requireAuthApi（API 用の認証ガード）+ セッション型拡張
src/api/                 JSON API: http(共通) / schemas(zod) / auth / tasks / categories / index
src/domain/defaults.ts   既定カテゴリ
prisma/schema.prisma     データモデル
client/                  React SPA（Vite + TS）
  src/api/               fetch ラッパと各エンドポイント呼び出し
  src/queries/           TanStack Query フック
  src/components/        Header / Layout / ProtectedRoute / TaskItem / TaskForm / FilterBar
  src/pages/             Login / Signup / Tasks / TaskDetail / Categories
```

## ローカルでの起動（開発）

フロントとバックを別プロセスで起動する（Vite が `/api` を Express へプロキシ）。

```bash
# 依存インストール（ルート + client）
npm install
npm --prefix client install

# .env に DATABASE_URL と SESSION_SECRET を設定（下記参照）
# 初回のみ: DB マイグレーション + Prisma Client 生成
npx prisma migrate deploy
npx prisma generate

# ターミナルA: API サーバ（:8888）
npm start
# ターミナルB: フロント開発サーバ（:5173）
npm --prefix client run dev
# → ブラウザで http://localhost:5173
```

本番相当の確認（Express が SPA を配信）:

```bash
npm --prefix client run build   # client/dist を生成
npm start                       # → http://localhost:8888
```

### 環境変数（`.env`）

```
DATABASE_URL="postgresql://..."          # PostgreSQL 接続文字列
SESSION_SECRET="<ランダムな長い文字列>"   # 例: openssl rand -hex 32
```

## デプロイ（Render）

`git push origin main` で Render が自動ビルド・デプロイする。詳細な手順は `info/deploy.md` を参照。

- **Build Command**: `npm ci && npm --prefix client ci && npm --prefix client run build && npx prisma generate && npx prisma migrate deploy`
- **Start Command**: `npm start`（Express が `client/dist` を配信）
- Render の Environment に `DATABASE_URL`（Internal）と `SESSION_SECRET` を設定すること。
