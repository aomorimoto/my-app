# タスク管理アプリ

Express + EJS + Prisma + PostgreSQL で作ったタスク管理アプリ。GitHub → Render で公開する。

## 機能

- アカウント登録 / ログイン / ログアウト（セッション認証）
- タスクの追加・編集・削除・完了切替
- タスクの項目: タイトル / 説明 / 状態（未着手・進行中・完了）/ 優先度（高・中・低）/ 期限 / カテゴリ
- カテゴリの作成・削除（色付き）
- 状態・優先度・カテゴリでの絞り込み、期限・優先度・作成日での並び替え
- 期限切れタスクの強調表示
- データはユーザーごとに分離（本人のタスク・カテゴリのみ閲覧／操作可能）

## 技術スタック

- **サーバ**: Express 5（TypeScript / tsx / ESM）
- **テンプレート**: EJS
- **DB / ORM**: PostgreSQL + Prisma 7（`@prisma/adapter-pg`）
- **認証**: express-session + connect-pg-simple（セッションを Postgres に保存）+ bcryptjs

## ディレクトリ構成

```
index.ts                 アプリ設定・セッション・ルータの組み立て
src/db.ts                pg Pool と Prisma クライアント（共有）
src/middleware.ts        認証ミドルウェア（requireAuth / loadUser）
src/routes/              auth / tasks / categories の各ルータ
views/                   EJS テンプレート（partials / tasks / ...）
public/style.css         スタイル
prisma/schema.prisma     データモデル
```

## ローカルでの起動

```bash
npm install

# .env に DATABASE_URL と SESSION_SECRET を設定（下記参照）

# DB マイグレーション + Prisma Client 生成
npx prisma migrate dev --name init
npx prisma generate

npm start   # http://localhost:8888/
```

### 環境変数（`.env`）

```
DATABASE_URL="postgresql://..."          # PostgreSQL 接続文字列
SESSION_SECRET="<ランダムな長い文字列>"   # 例: openssl rand -hex 32
```

## デプロイ（Render）

`git push origin main` で Render が自動ビルド・デプロイする。詳細な手順は `info/deploy.md` を参照。

- **Build Command**: `npm clean-install && npx prisma generate && npx prisma migrate deploy`
- **Start Command**: `npm start`
- Render の Environment に `DATABASE_URL`（Internal）と `SESSION_SECRET` を設定すること。
