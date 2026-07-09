# taskapp MCP サーバ

タスク管理アプリを **MCP サーバ**として公開し、Claude Desktop / Claude Code から会話でタスクを操作（一覧・要約・作成・更新・完了・削除）できるようにする。知能は Claude 側が担い、このサーバは既存の REST `/api` を **Bearer トークン**で叩くだけ（`info/design.md` §8）。

- トランスポート: **stdio**（Claude がサブプロセスとして起動）
- 認証: **個人アクセストークン**（`Authorization: Bearer <token>`）
- 接続先: ローカル `http://localhost:8888` / 本番は Render の URL

## 公開ツール

| ツール | 説明 |
|---|---|
| `list_tasks` | タスク一覧（status/priority/category/assignee/tag 絞り込み・`q` 検索・`sort`・`page`） |
| `get_task` | タスク1件の詳細 |
| `list_categories` | カテゴリ一覧 |
| `create_task` | タスク作成（`title` 必須ほか） |
| `update_task` | タスク部分更新 |
| `toggle_complete` | 完了トグル（DONE ⇔ TODO） |
| `delete_task` | **破壊的**：タスク削除 |
| `create_category` | カテゴリ作成（OWNER/ADMIN） |

「直近を要約」「期限切れを進行中に整理」等は専用ツールを作らず、Claude が上記を組み合わせて実現する。

## セットアップ

### 1) 依存インストール（このディレクトリで）

```
npm --prefix mcp install
```

### 2) 個人アクセストークンを発行（リポジトリのルートで）

```
npm run token:create -- --email <あなたのログインメール> --label mcp
```

表示された平文トークン（`pat_...`）を控える（**再表示されない**）。一覧は `npm run token:list`、失効は `npm run token:revoke -- --id <n>`。

### 3) Claude 側に登録

**Claude Desktop**（`claude_desktop_config.json`）／**Claude Code**（プロジェクト直下 `.mcp.json`）に追加：

```json
{
  "mcpServers": {
    "taskapp": {
      "command": "npx",
      "args": ["-y", "tsx", "/絶対パス/my-app/mcp/src/server.ts"],
      "env": {
        "TASKAPP_BASE_URL": "http://localhost:8888",
        "TASKAPP_TOKEN": "pat_ここに発行したトークン"
      }
    }
  }
}
```

- ローカルで使う場合は、別ターミナルでアプリ本体を起動しておく（ルートで `npm start`）。
- 本番に向ける場合は `TASKAPP_BASE_URL` を Render の URL に変える。
- **トークンはコミットしない**（設定ファイルにのみ保管）。漏洩時は `token:revoke` で失効。

### 4) 動作確認

Claude 側で「タスクを一覧して」「『牛乳を買う』を作成して」等を依頼し、実データ（DB）に反映されることを確認する。破壊的操作（`delete_task`）は Claude の実行前確認が人間のゲートになる。
