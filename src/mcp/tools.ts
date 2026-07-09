import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api, toQuery } from "./api";

// タスク管理アプリ（REST /api）を MCP ツールとして公開する（トランスポート非依存）。
// 「要約」「整理」は専用ツールにせず、Claude が下記ツールを組み合わせて実現する（design.md §8）。
// リモート版では各ツールが、OAuth で検証済みのアクセストークン（extra.authInfo.token）を
// ループバック /api へ転送して実行する。

// requireBearerAuth が載せた authInfo から Bearer トークンを取り出す。
function tokenOf(extra: { authInfo?: { token?: string } }): string {
  const token = extra.authInfo?.token;
  if (!token) throw new Error("認証情報がありません。");
  return token;
}

// JSON をそのままテキストで返すヘルパ（MCP のツール結果形式）。
function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

// taskFields を全て optional にした形（update 用）。
function partial<T extends Record<string, z.ZodTypeAny>>(shape: T) {
  const out: Record<string, z.ZodTypeAny> = {};
  for (const [k, v] of Object.entries(shape)) out[k] = v.optional();
  return out as { [K in keyof T]: z.ZodOptional<T[K]> };
}

// タスク作成/更新で共有する入力フィールド（REST の taskCreateSchema 準拠）。
const taskFields = {
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  dueDate: z.string().describe("ISO 日付（例 2026-07-31）。空にするには null").nullable().optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  parentId: z.number().int().positive().describe("親タスクID（サブタスク化）").nullable().optional(),
  tagIds: z.array(z.number().int().positive()).optional(),
};

// taskapp の全ツールを MCP サーバに登録する。
export function registerTaskappTools(server: McpServer) {
  // --- 読み取り ---

  server.registerTool(
    "list_tasks",
    {
      title: "タスク一覧",
      description:
        "アクティブなワークスペースのトップレベルタスクを一覧する。status/priority/category/assignee/tag による絞り込み、q によるキーワード検索、sort（dueDate|priority）、page によるページネーションに対応。",
      inputSchema: {
        status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
        priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
        category: z.number().int().positive().describe("カテゴリID").optional(),
        assignee: z.number().int().positive().describe("担当者ユーザーID").optional(),
        tag: z.number().int().positive().describe("タグID").optional(),
        q: z.string().describe("タイトル/説明のキーワード").optional(),
        sort: z.enum(["dueDate", "priority"]).optional(),
        page: z.number().int().positive().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async (args, extra) => ok(await api("GET", `/api/tasks${toQuery(args)}`, tokenOf(extra)))
  );

  server.registerTool(
    "get_task",
    {
      title: "タスク詳細",
      description: "ID を指定してタスク1件の詳細（サブタスク・タグ・コメント件数含む）を取得する。",
      inputSchema: { id: z.number().int().positive() },
      annotations: { readOnlyHint: true },
    },
    async ({ id }, extra) => ok(await api("GET", `/api/tasks/${id}`, tokenOf(extra)))
  );

  server.registerTool(
    "list_categories",
    {
      title: "カテゴリ一覧",
      description: "アクティブなワークスペースのカテゴリ一覧（タスク件数付き）を取得する。",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async (_args, extra) => ok(await api("GET", "/api/categories", tokenOf(extra)))
  );

  // --- 書き込み ---

  server.registerTool(
    "create_task",
    {
      title: "タスク作成",
      description:
        "タスクを新規作成する。title は必須。categoryId/assigneeId/tagIds は同ワークスペースのものだけ指定可。",
      inputSchema: taskFields,
    },
    async (args, extra) => ok(await api("POST", "/api/tasks", tokenOf(extra), args))
  );

  server.registerTool(
    "update_task",
    {
      title: "タスク更新",
      description: "既存タスクを部分更新する。送ったフィールドだけ変更される。",
      inputSchema: { id: z.number().int().positive(), ...partial(taskFields) },
    },
    async ({ id, ...rest }, extra) =>
      ok(await api("PATCH", `/api/tasks/${id}`, tokenOf(extra), rest))
  );

  server.registerTool(
    "toggle_complete",
    {
      title: "完了トグル",
      description: "タスクの完了状態を切り替える（DONE ⇔ TODO）。",
      inputSchema: { id: z.number().int().positive() },
    },
    async ({ id }, extra) => ok(await api("POST", `/api/tasks/${id}/toggle`, tokenOf(extra)))
  );

  server.registerTool(
    "delete_task",
    {
      title: "タスク削除",
      description:
        "【破壊的】タスクを完全に削除する。サブタスク・コメントも連鎖削除される。取り消し不可。",
      inputSchema: { id: z.number().int().positive() },
      annotations: { destructiveHint: true },
    },
    async ({ id }, extra) => {
      await api("DELETE", `/api/tasks/${id}`, tokenOf(extra));
      return ok({ deleted: id });
    }
  );

  server.registerTool(
    "create_category",
    {
      title: "カテゴリ作成",
      description: "カテゴリを新規作成する（OWNER/ADMIN のみ）。color は #RRGGBB。",
      inputSchema: {
        name: z.string().min(1).max(50),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      },
    },
    async (args, extra) => ok(await api("POST", "/api/categories", tokenOf(extra), args))
  );
}
