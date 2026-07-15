import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api, toQuery } from "./api";

// Delegaru（タスク管理アプリ, REST /api）を MCP ツールとして公開する（トランスポート非依存）。
// 「要約」「整理」は専用ツールにせず、Claude が下記ツールを組み合わせて実現する（design.md §8）。
// リモート版では各ツールが、OAuth で検証済みのアクセストークン（extra.authInfo.token）を
// ループバック /api へ転送して実行する。
//
// ワークスペース: 接続アカウントは複数ワークスペースに所属しうる。各ツールは任意の
// workspaceId を受け取り、X-Workspace-Id ヘッダとして /api に転送する（省略時は既定＝先頭WS）。
// 対象WSの所属・役割チェックは既存の /api がそのまま強制する（member/admin の権限内で動作）。

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

// 対象ワークスペースを指定する共通フィールド（resolveWorkspace 経由のツール向け）。
// 省略時は接続アカウントの先頭（既定）ワークスペース。ID は list_workspaces で確認できる。
const workspaceIdField = z
  .number()
  .int()
  .positive()
  .describe("対象ワークスペースID。省略時は既定(先頭)のワークスペース。list_workspaces で確認できる。")
  .optional();

// 付与可能な役割（OWNER は API から付与不可）。
const assignableRole = z.enum(["ADMIN", "MEMBER"]);

// タスク作成/更新で共有する入力フィールド（REST の taskCreateSchema 準拠）。
const taskFields = {
  title: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
  priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
  dueDate: z.string().describe("ISO 日付（例 2026-07-31）。空にするには null").nullable().optional(),
  assigneeId: z
    .number()
    .int()
    .positive()
    .describe("担当ユーザーID（人間メンバー）。エージェントとは排他")
    .nullable()
    .optional(),
  assigneeAgentId: z
    .number()
    .int()
    .positive()
    .describe("担当エージェントID（AI）。ユーザー担当とは排他")
    .nullable()
    .optional(),
  parentId: z.number().int().positive().describe("親タスクID（サブタスク化）").nullable().optional(),
  tagIds: z.array(z.number().int().positive()).optional(),
  recurrenceRule: z
    .string()
    .describe(
      "繰り返しルール（RRULE 風。FREQ=DAILY|WEEKLY|MONTHLY|YEARLY、任意で INTERVAL=n・BYDAY=MO,WE 等。例 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO'）。完了トグル時に次回分を自動生成する。繰り返しなしにするには null。"
    )
    .nullable()
    .optional(),
};

// Delegaru の全ツールを MCP サーバに登録する。
export function registerTaskappTools(server: McpServer) {
  // --- ワークスペース（読み取り） ---

  server.registerTool(
    "list_workspaces",
    {
      title: "ワークスペース一覧",
      description:
        "接続アカウントが所属する全ワークスペースを一覧する（自分の役割 role・メンバー数付き）。ここで得た id を他ツールの workspaceId に指定すると、そのワークスペースを対象に操作できる。",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async (_args, extra) => ok(await api("GET", "/api/workspaces", tokenOf(extra)))
  );

  // --- タスク（読み取り） ---

  server.registerTool(
    "list_tasks",
    {
      title: "タスク一覧",
      description:
        "指定ワークスペース（省略時は既定）のトップレベルタスクを一覧する。status/priority/assignee(担当ユーザー)/agent(担当エージェント)/tag による絞り込み、q によるキーワード検索、sort（dueDate|priority）、page によるページネーションに対応。" +
        "【階層構造】配列の要素はトップレベルタスクのみ。各タスクの子タスクは subtasks フィールドに入れ子（多階層）で入り、_count.subtasks に直下の子の件数が入る。サブタスクは独立したタスクではなく親タスクの手順/内訳なので、一覧や要約では親子のツリー構造を保って提示し、タスク件数を数えるときにサブタスクをトップレベルタスクと混同しないこと。",
      inputSchema: {
        workspaceId: workspaceIdField,
        status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
        priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
        assignee: z.number().int().positive().describe("担当ユーザーID").optional(),
        agent: z.number().int().positive().describe("担当エージェントID").optional(),
        tag: z.number().int().positive().describe("タグID").optional(),
        q: z.string().describe("タイトル/説明のキーワード").optional(),
        sort: z.enum(["dueDate", "priority"]).optional(),
        page: z.number().int().positive().optional(),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ workspaceId, ...query }, extra) =>
      ok(await api("GET", `/api/tasks${toQuery(query)}`, tokenOf(extra), { workspaceId }))
  );

  server.registerTool(
    "list_all_tasks",
    {
      title: "全ワークスペース横断タスク一覧",
      description:
        "接続アカウントが所属する『すべてのワークスペース』のトップレベルタスクを横断して一覧する。各タスクに所属先 workspace{id,name} が付く。特定のワークスペースに限定せず全体を俯瞰したいとき（例: 期限が近いものを全WSから集める）に使う。個別WSの絞り込みは list_tasks を使う。" +
        "【階層構造】配列の要素はトップレベルタスクのみ。各タスクの子タスクは subtasks フィールドに入れ子（多階層）で入り、_count.subtasks に直下の子の件数が入る。サブタスクは独立したタスクではなく親タスクの手順/内訳なので、親子のツリー構造を保って提示し、タスク件数を数えるときにサブタスクをトップレベルタスクと混同しないこと。",
      inputSchema: {},
      annotations: { readOnlyHint: true },
    },
    async (_args, extra) => ok(await api("GET", "/api/home/tasks", tokenOf(extra)))
  );

  server.registerTool(
    "get_task",
    {
      title: "タスク詳細",
      description:
        "ID を指定してタスク1件の詳細を取得する。子タスクは subtasks フィールドに入れ子（多階層）のツリーで、親から現在までの祖先チェーンは ancestors に入る。サブタスクは親タスクの手順/内訳として扱い、独立タスクと混同しないこと。タスクが既定以外のワークスペースにある場合は workspaceId も指定する。",
      inputSchema: { id: z.number().int().positive(), workspaceId: workspaceIdField },
      annotations: { readOnlyHint: true },
    },
    async ({ id, workspaceId }, extra) =>
      ok(await api("GET", `/api/tasks/${id}`, tokenOf(extra), { workspaceId }))
  );

  server.registerTool(
    "list_agents",
    {
      title: "エージェント一覧",
      description:
        "指定ワークスペース（省略時は既定）の AI エージェント一覧（担当タスク件数付き）を取得する。create_task/update_task の assigneeAgentId に指定できる。",
      inputSchema: { workspaceId: workspaceIdField },
      annotations: { readOnlyHint: true },
    },
    async ({ workspaceId }, extra) =>
      ok(await api("GET", "/api/agents", tokenOf(extra), { workspaceId }))
  );

  server.registerTool(
    "list_tags",
    {
      title: "タグ一覧",
      description:
        "指定ワークスペース（省略時は既定）のタグ一覧（付与タスク件数付き）を取得する。create_task/update_task の tagIds に指定できる。",
      inputSchema: { workspaceId: workspaceIdField },
      annotations: { readOnlyHint: true },
    },
    async ({ workspaceId }, extra) =>
      ok(await api("GET", "/api/tags", tokenOf(extra), { workspaceId }))
  );

  server.registerTool(
    "list_members",
    {
      title: "メンバー一覧",
      description:
        "指定ワークスペースの人間メンバー一覧（役割付き）を取得する。add_member/update_member_role/remove_member の対象ユーザーIDや、タスクの assigneeId を調べるのに使う。",
      inputSchema: { workspaceId: z.number().int().positive().describe("対象ワークスペースID") },
      annotations: { readOnlyHint: true },
    },
    async ({ workspaceId }, extra) =>
      ok(await api("GET", `/api/workspaces/${workspaceId}/members`, tokenOf(extra)))
  );

  // --- タスク（書き込み） ---

  server.registerTool(
    "create_task",
    {
      title: "タスク作成",
      description:
        "タスクを新規作成する。title は必須。assigneeId/assigneeAgentId/tagIds は同ワークスペースのものだけ指定可（担当はユーザーかエージェントの一方のみ）。既定以外のワークスペースに作る場合は workspaceId を指定する。",
      inputSchema: { workspaceId: workspaceIdField, ...taskFields },
    },
    async ({ workspaceId, ...body }, extra) =>
      ok(await api("POST", "/api/tasks", tokenOf(extra), { body, workspaceId }))
  );

  server.registerTool(
    "update_task",
    {
      title: "タスク更新",
      description:
        "既存タスクを部分更新する。送ったフィールドだけ変更される。タスクが既定以外のワークスペースにある場合は workspaceId も指定する。",
      inputSchema: { id: z.number().int().positive(), workspaceId: workspaceIdField, ...partial(taskFields) },
    },
    async ({ id, workspaceId, ...body }, extra) =>
      ok(await api("PATCH", `/api/tasks/${id}`, tokenOf(extra), { body, workspaceId }))
  );

  server.registerTool(
    "toggle_complete",
    {
      title: "完了トグル",
      description:
        "タスクの完了状態を切り替える（DONE ⇔ TODO）。既定以外のワークスペースのタスクは workspaceId を指定する。",
      inputSchema: { id: z.number().int().positive(), workspaceId: workspaceIdField },
    },
    async ({ id, workspaceId }, extra) =>
      ok(await api("POST", `/api/tasks/${id}/toggle`, tokenOf(extra), { workspaceId }))
  );

  server.registerTool(
    "delete_task",
    {
      title: "タスク削除",
      description:
        "【破壊的】タスクを完全に削除する。サブタスク・コメントも連鎖削除される。取り消し不可。既定以外のワークスペースのタスクは workspaceId を指定する。",
      inputSchema: { id: z.number().int().positive(), workspaceId: workspaceIdField },
      annotations: { destructiveHint: true },
    },
    async ({ id, workspaceId }, extra) => {
      await api("DELETE", `/api/tasks/${id}`, tokenOf(extra), { workspaceId });
      return ok({ deleted: id });
    }
  );

  // --- エージェント（書き込み） ---

  server.registerTool(
    "create_agent",
    {
      title: "エージェント作成",
      description:
        "AI エージェントを新規登録する（登録者が owner になる）。以後 assigneeAgentId で担当に指定できる。color は #RRGGBB。既定以外のワークスペースは workspaceId を指定する。",
      inputSchema: {
        workspaceId: workspaceIdField,
        name: z.string().min(1).max(50),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      },
    },
    async ({ workspaceId, ...body }, extra) =>
      ok(await api("POST", "/api/agents", tokenOf(extra), { body, workspaceId }))
  );

  server.registerTool(
    "update_agent",
    {
      title: "エージェント更新",
      description:
        "エージェントの名前/色を更新する（OWNER/ADMIN または登録者本人のみ）。エージェントが既定以外のワークスペースにある場合は workspaceId を指定する。",
      inputSchema: {
        id: z.number().int().positive(),
        workspaceId: workspaceIdField,
        name: z.string().min(1).max(50).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      },
    },
    async ({ id, workspaceId, ...body }, extra) =>
      ok(await api("PATCH", `/api/agents/${id}`, tokenOf(extra), { body, workspaceId }))
  );

  server.registerTool(
    "delete_agent",
    {
      title: "エージェント削除",
      description:
        "【破壊的】エージェントを削除する（OWNER/ADMIN または登録者本人のみ）。担当タスクは未割当に戻る。既定以外のワークスペースは workspaceId を指定する。",
      inputSchema: { id: z.number().int().positive(), workspaceId: workspaceIdField },
      annotations: { destructiveHint: true },
    },
    async ({ id, workspaceId }, extra) => {
      await api("DELETE", `/api/agents/${id}`, tokenOf(extra), { workspaceId });
      return ok({ deleted: id });
    }
  );

  // --- タグ（書き込み） ---

  server.registerTool(
    "create_tag",
    {
      title: "タグ作成",
      description:
        "タグを新規作成する（OWNER/ADMIN のみ）。color は #RRGGBB（省略時グレー）。以後 tagIds で付与できる。既定以外のワークスペースは workspaceId を指定する。",
      inputSchema: {
        workspaceId: workspaceIdField,
        name: z.string().min(1).max(50),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      },
    },
    async ({ workspaceId, ...body }, extra) =>
      ok(await api("POST", "/api/tags", tokenOf(extra), { body, workspaceId }))
  );

  // --- ワークスペース / メンバー管理（書き込み） ---

  server.registerTool(
    "create_workspace",
    {
      title: "ワークスペース作成",
      description: "新しいワークスペースを作成する（作成者が OWNER になる）。",
      inputSchema: { name: z.string().min(1).max(50) },
    },
    async (body, extra) => ok(await api("POST", "/api/workspaces", tokenOf(extra), { body }))
  );

  server.registerTool(
    "update_workspace",
    {
      title: "ワークスペース更新",
      description:
        "ワークスペースの名前/アイコン色を更新する（OWNER/ADMIN のみ）。iconColor は #RRGGBB。",
      inputSchema: {
        workspaceId: z.number().int().positive().describe("対象ワークスペースID"),
        name: z.string().min(1).max(50).optional(),
        iconColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
      },
    },
    async ({ workspaceId, ...body }, extra) =>
      ok(await api("PATCH", `/api/workspaces/${workspaceId}`, tokenOf(extra), { body }))
  );

  server.registerTool(
    "add_member",
    {
      title: "メンバー追加",
      description:
        "既存ユーザーをユーザーID（username）でワークスペースに追加する（OWNER/ADMIN のみ）。role 省略時は MEMBER。相手は登録済みユーザーである必要がある。username は list_members で確認できる。",
      inputSchema: {
        workspaceId: z.number().int().positive().describe("対象ワークスペースID"),
        username: z.string().min(1).describe("追加するユーザーのユーザーID"),
        role: assignableRole.optional(),
      },
    },
    async ({ workspaceId, ...body }, extra) =>
      ok(await api("POST", `/api/workspaces/${workspaceId}/members`, tokenOf(extra), { body }))
  );

  server.registerTool(
    "update_member_role",
    {
      title: "メンバー役割変更",
      description:
        "メンバーの役割を ADMIN / MEMBER に変更する（OWNER/ADMIN のみ）。OWNER の役割は変更不可。userId は list_members で確認する。",
      inputSchema: {
        workspaceId: z.number().int().positive().describe("対象ワークスペースID"),
        userId: z.number().int().positive().describe("対象ユーザーID"),
        role: assignableRole,
      },
    },
    async ({ workspaceId, userId, role }, extra) =>
      ok(
        await api("PATCH", `/api/workspaces/${workspaceId}/members/${userId}`, tokenOf(extra), {
          body: { role },
        })
      )
  );

  server.registerTool(
    "remove_member",
    {
      title: "メンバー削除",
      description:
        "メンバーをワークスペースから外す（OWNER/ADMIN のみ）。OWNER は削除不可。担当タスクは未割当に戻る。userId は list_members で確認する。",
      inputSchema: {
        workspaceId: z.number().int().positive().describe("対象ワークスペースID"),
        userId: z.number().int().positive().describe("対象ユーザーID"),
      },
      annotations: { destructiveHint: true },
    },
    async ({ workspaceId, userId }, extra) => {
      await api("DELETE", `/api/workspaces/${workspaceId}/members/${userId}`, tokenOf(extra));
      return ok({ removed: userId, workspaceId });
    }
  );

  // --- コメント（タスク配下） ---

  server.registerTool(
    "list_comments",
    {
      title: "コメント一覧",
      description:
        "指定タスクのコメントを古い順に取得する（投稿者情報付き）。taskId は list_tasks / get_task で調べる。タスクが既定以外のワークスペースにある場合は workspaceId も指定する。",
      inputSchema: {
        taskId: z.number().int().positive().describe("対象タスクID"),
        workspaceId: workspaceIdField,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ taskId, workspaceId }, extra) =>
      ok(await api("GET", `/api/tasks/${taskId}/comments`, tokenOf(extra), { workspaceId }))
  );

  server.registerTool(
    "add_comment",
    {
      title: "コメント投稿",
      description:
        "指定タスクにコメントを投稿する（メンバーなら誰でも可）。投稿者は接続アカウント。既定以外のワークスペースのタスクは workspaceId を指定する。",
      inputSchema: {
        taskId: z.number().int().positive().describe("対象タスクID"),
        body: z.string().min(1).max(2000).describe("コメント本文"),
        workspaceId: workspaceIdField,
      },
    },
    async ({ taskId, body, workspaceId }, extra) =>
      ok(
        await api("POST", `/api/tasks/${taskId}/comments`, tokenOf(extra), {
          body: { body },
          workspaceId,
        })
      )
  );

  server.registerTool(
    "update_comment",
    {
      title: "コメント編集",
      description:
        "コメント本文を編集する（投稿者本人 または OWNER/ADMIN のみ）。commentId は list_comments で調べる。既定以外のワークスペースのタスクは workspaceId を指定する。",
      inputSchema: {
        taskId: z.number().int().positive().describe("対象タスクID"),
        commentId: z.number().int().positive().describe("対象コメントID"),
        body: z.string().min(1).max(2000).describe("新しいコメント本文"),
        workspaceId: workspaceIdField,
      },
    },
    async ({ taskId, commentId, body, workspaceId }, extra) =>
      ok(
        await api("PATCH", `/api/tasks/${taskId}/comments/${commentId}`, tokenOf(extra), {
          body: { body },
          workspaceId,
        })
      )
  );

  server.registerTool(
    "delete_comment",
    {
      title: "コメント削除",
      description:
        "【破壊的】コメントを削除する（投稿者本人 または OWNER/ADMIN のみ）。取り消し不可。commentId は list_comments で調べる。既定以外のワークスペースのタスクは workspaceId を指定する。",
      inputSchema: {
        taskId: z.number().int().positive().describe("対象タスクID"),
        commentId: z.number().int().positive().describe("対象コメントID"),
        workspaceId: workspaceIdField,
      },
      annotations: { destructiveHint: true },
    },
    async ({ taskId, commentId, workspaceId }, extra) => {
      await api("DELETE", `/api/tasks/${taskId}/comments/${commentId}`, tokenOf(extra), {
        workspaceId,
      });
      return ok({ deleted: commentId });
    }
  );
}
