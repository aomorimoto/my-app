import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { api, toQuery, resolveWorkspacePublicId } from "./api";

// Delegaru（タスク管理アプリ, REST /api）を MCP ツールとして公開する（トランスポート非依存）。
// 「要約」「整理」は専用ツールにせず、Claude が下記ツールを組み合わせて実現する（design.md §8）。
// リモート版では各ツールが、OAuth で検証済みのアクセストークン（extra.authInfo.token）を
// ループバック /api へ転送して実行する。
//
// Phase 16: API は URL 駆動。ツールに露出する識別子は
//   - ワークスペース = 公開ID（publicId, 不透明な文字列。list_workspaces で確認）
//   - タスク         = ワークスペース内の連番 number（#1,#2…。list_tasks / get_task で確認）
// で統一する（内部の連番 id は露出しない）。ユーザー/エージェント/タグ/コメントは従来どおり id で指す。
// 対象WSの publicId は各ツールの workspace で指定する（省略時は接続アカウントの先頭WS）。
// 所属・役割チェックは既存の /api がそのまま強制する（member/admin の権限内で動作）。

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

// 対象ワークスペースのスコープ付きベースパス（/api/w/:publicId）を返す。
// workspace 省略時は接続アカウントの先頭WSに解決する。
async function wsBase(token: string, workspace: string | undefined): Promise<string> {
  return `/api/w/${await resolveWorkspacePublicId(token, workspace)}`;
}

// taskFields を全て optional にした形（update 用）。
function partial<T extends Record<string, z.ZodTypeAny>>(shape: T) {
  const out: Record<string, z.ZodTypeAny> = {};
  for (const [k, v] of Object.entries(shape)) out[k] = v.optional();
  return out as { [K in keyof T]: z.ZodOptional<T[K]> };
}

// 対象ワークスペースの公開ID（任意）。省略時は接続アカウントの先頭（既定）ワークスペース。
const workspaceField = z
  .string()
  .min(1)
  .describe("対象ワークスペースの公開ID（publicId）。list_workspaces で確認できる。省略時は既定(先頭)ワークスペース。")
  .optional();

// 対象ワークスペースの公開ID（必須）。
const workspaceFieldRequired = z
  .string()
  .min(1)
  .describe("対象ワークスペースの公開ID（publicId）。list_workspaces で確認できる。");

// ワークスペース内のタスク番号（#1,#2…）。
const taskNumberField = z
  .number()
  .int()
  .positive()
  .describe("ワークスペース内のタスク番号（#1,#2…）。list_tasks / get_task で確認できる。");

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
    .describe("担当ユーザーID（人間メンバー）。エージェントとは排他。list_members で確認")
    .nullable()
    .optional(),
  assigneeAgentId: z
    .number()
    .int()
    .positive()
    .describe("担当エージェントID（AI）。ユーザー担当とは排他。list_agents で確認")
    .nullable()
    .optional(),
  parentNumber: z
    .number()
    .int()
    .positive()
    .describe("親タスクの番号（サブタスク化）。同じワークスペース内のタスク番号（#1,#2…）")
    .nullable()
    .optional(),
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
        "接続アカウントが所属する全ワークスペースを一覧する（自分の役割 role・メンバー数付き）。ここで得た publicId を他ツールの workspace に指定すると、そのワークスペースを対象に操作できる。",
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
        "指定ワークスペース（省略時は既定）のトップレベルタスクを一覧する。status/priority/assignee(担当ユーザーID)/agent(担当エージェントID)/tag(タグID) による絞り込み、q によるキーワード検索、sort（dueDate|priority）、page によるページネーションに対応。" +
        "各タスクの number（#1,#2…）が個別操作（get_task / update_task 等）の識別子。" +
        "【階層構造】配列の要素はトップレベルタスクのみ。各タスクの子タスクは subtasks フィールドに入れ子（多階層）で入り、_count.subtasks に直下の子の件数が入る。サブタスクは独立したタスクではなく親タスクの手順/内訳なので、一覧や要約では親子のツリー構造を保って提示し、タスク件数を数えるときにサブタスクをトップレベルタスクと混同しないこと。",
      inputSchema: {
        workspace: workspaceField,
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
    async ({ workspace, ...query }, extra) => {
      const token = tokenOf(extra);
      return ok(await api("GET", `${await wsBase(token, workspace)}/tasks${toQuery(query)}`, token));
    }
  );

  server.registerTool(
    "list_all_tasks",
    {
      title: "全ワークスペース横断タスク一覧",
      description:
        "接続アカウントが所属する『すべてのワークスペース』のトップレベルタスクを横断して一覧する。各タスクに所属先 workspace{publicId,name} と番号 number が付く。特定のワークスペースに限定せず全体を俯瞰したいとき（例: 期限が近いものを全WSから集める）に使う。個別のタスクを操作するには workspace(publicId)+number を各ツールに渡す。個別WSの絞り込みは list_tasks を使う。" +
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
        "ワークスペース内のタスク番号（number）を指定してタスク1件の詳細を取得する。子タスクは subtasks フィールドに入れ子（多階層）のツリーで、親から現在までの祖先チェーンは ancestors（各要素の number 付き）に入る。サブタスクは親タスクの手順/内訳として扱い、独立タスクと混同しないこと。既定以外のワークスペースのタスクは workspace も指定する。",
      inputSchema: { number: taskNumberField, workspace: workspaceField },
      annotations: { readOnlyHint: true },
    },
    async ({ number, workspace }, extra) => {
      const token = tokenOf(extra);
      return ok(await api("GET", `${await wsBase(token, workspace)}/tasks/${number}`, token));
    }
  );

  server.registerTool(
    "list_agents",
    {
      title: "エージェント一覧",
      description:
        "指定ワークスペース（省略時は既定）の AI エージェント一覧（担当タスク件数付き）を取得する。create_task/update_task の assigneeAgentId に指定できる。",
      inputSchema: { workspace: workspaceField },
      annotations: { readOnlyHint: true },
    },
    async ({ workspace }, extra) => {
      const token = tokenOf(extra);
      return ok(await api("GET", `${await wsBase(token, workspace)}/agents`, token));
    }
  );

  server.registerTool(
    "list_tags",
    {
      title: "タグ一覧",
      description:
        "指定ワークスペース（省略時は既定）のタグ一覧（付与タスク件数付き）を取得する。create_task/update_task の tagIds に指定できる。",
      inputSchema: { workspace: workspaceField },
      annotations: { readOnlyHint: true },
    },
    async ({ workspace }, extra) => {
      const token = tokenOf(extra);
      return ok(await api("GET", `${await wsBase(token, workspace)}/tags`, token));
    }
  );

  server.registerTool(
    "list_members",
    {
      title: "メンバー一覧",
      description:
        "指定ワークスペースの人間メンバー一覧（役割付き）を取得する。add_member/update_member_role/remove_member の対象ユーザーIDや、タスクの assigneeId を調べるのに使う。",
      inputSchema: { workspace: workspaceFieldRequired },
      annotations: { readOnlyHint: true },
    },
    async ({ workspace }, extra) => {
      const token = tokenOf(extra);
      return ok(await api("GET", `${await wsBase(token, workspace)}/members`, token));
    }
  );

  // --- タスク（書き込み） ---

  server.registerTool(
    "create_task",
    {
      title: "タスク作成",
      description:
        "タスクを新規作成する。title は必須。assigneeId/assigneeAgentId/tagIds は同ワークスペースのものだけ指定可（担当はユーザーかエージェントの一方のみ）。parentNumber を指定すると同WS内のそのタスクのサブタスクになる。既定以外のワークスペースに作る場合は workspace を指定する。",
      inputSchema: { workspace: workspaceField, ...taskFields },
    },
    async ({ workspace, ...body }, extra) => {
      const token = tokenOf(extra);
      return ok(await api("POST", `${await wsBase(token, workspace)}/tasks`, token, { body }));
    }
  );

  server.registerTool(
    "update_task",
    {
      title: "タスク更新",
      description:
        "既存タスクを部分更新する（number で指定）。送ったフィールドだけ変更される。既定以外のワークスペースのタスクは workspace も指定する。",
      inputSchema: { number: taskNumberField, workspace: workspaceField, ...partial(taskFields) },
    },
    async ({ number, workspace, ...body }, extra) => {
      const token = tokenOf(extra);
      return ok(await api("PATCH", `${await wsBase(token, workspace)}/tasks/${number}`, token, { body }));
    }
  );

  server.registerTool(
    "toggle_complete",
    {
      title: "完了トグル",
      description:
        "タスク（number 指定）の完了状態を切り替える（DONE ⇔ TODO）。既定以外のワークスペースのタスクは workspace を指定する。",
      inputSchema: { number: taskNumberField, workspace: workspaceField },
    },
    async ({ number, workspace }, extra) => {
      const token = tokenOf(extra);
      return ok(await api("POST", `${await wsBase(token, workspace)}/tasks/${number}/toggle`, token));
    }
  );

  server.registerTool(
    "delete_task",
    {
      title: "タスク削除",
      description:
        "【破壊的】タスク（number 指定）を完全に削除する。サブタスク・コメントも連鎖削除される。取り消し不可。既定以外のワークスペースのタスクは workspace を指定する。",
      inputSchema: { number: taskNumberField, workspace: workspaceField },
      annotations: { destructiveHint: true },
    },
    async ({ number, workspace }, extra) => {
      const token = tokenOf(extra);
      await api("DELETE", `${await wsBase(token, workspace)}/tasks/${number}`, token);
      return ok({ deleted: number });
    }
  );

  // --- エージェント（書き込み） ---

  server.registerTool(
    "create_agent",
    {
      title: "エージェント作成",
      description:
        "AI エージェントを新規登録する（登録者が owner になる）。以後 assigneeAgentId で担当に指定できる。color は #RRGGBB。既定以外のワークスペースは workspace を指定する。",
      inputSchema: {
        workspace: workspaceField,
        name: z.string().min(1).max(50),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      },
    },
    async ({ workspace, ...body }, extra) => {
      const token = tokenOf(extra);
      return ok(await api("POST", `${await wsBase(token, workspace)}/agents`, token, { body }));
    }
  );

  server.registerTool(
    "update_agent",
    {
      title: "エージェント更新",
      description:
        "エージェント（id 指定）の名前/色を更新する（OWNER/ADMIN または登録者本人のみ）。既定以外のワークスペースにある場合は workspace を指定する。",
      inputSchema: {
        id: z.number().int().positive().describe("エージェントID（list_agents で確認）"),
        workspace: workspaceField,
        name: z.string().min(1).max(50).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      },
    },
    async ({ id, workspace, ...body }, extra) => {
      const token = tokenOf(extra);
      return ok(await api("PATCH", `${await wsBase(token, workspace)}/agents/${id}`, token, { body }));
    }
  );

  server.registerTool(
    "delete_agent",
    {
      title: "エージェント削除",
      description:
        "【破壊的】エージェント（id 指定）を削除する（OWNER/ADMIN または登録者本人のみ）。担当タスクは未割当に戻る。既定以外のワークスペースは workspace を指定する。",
      inputSchema: {
        id: z.number().int().positive().describe("エージェントID（list_agents で確認）"),
        workspace: workspaceField,
      },
      annotations: { destructiveHint: true },
    },
    async ({ id, workspace }, extra) => {
      const token = tokenOf(extra);
      await api("DELETE", `${await wsBase(token, workspace)}/agents/${id}`, token);
      return ok({ deleted: id });
    }
  );

  // --- タグ（書き込み） ---

  server.registerTool(
    "create_tag",
    {
      title: "タグ作成",
      description:
        "タグを新規作成する（OWNER/ADMIN のみ）。color は #RRGGBB（省略時グレー）。以後 tagIds で付与できる。既定以外のワークスペースは workspace を指定する。",
      inputSchema: {
        workspace: workspaceField,
        name: z.string().min(1).max(50),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      },
    },
    async ({ workspace, ...body }, extra) => {
      const token = tokenOf(extra);
      return ok(await api("POST", `${await wsBase(token, workspace)}/tags`, token, { body }));
    }
  );

  // --- ワークスペース / メンバー管理（書き込み） ---

  server.registerTool(
    "create_workspace",
    {
      title: "ワークスペース作成",
      description: "新しいワークスペースを作成する（作成者が OWNER になる）。応答の publicId を以後の workspace に使う。",
      inputSchema: { name: z.string().min(1).max(50) },
    },
    async (body, extra) => ok(await api("POST", "/api/workspaces", tokenOf(extra), { body }))
  );

  server.registerTool(
    "update_workspace",
    {
      title: "ワークスペース更新",
      description:
        "ワークスペース（publicId 指定）の名前/アイコン色を更新する（OWNER/ADMIN のみ）。iconColor は #RRGGBB。",
      inputSchema: {
        workspace: workspaceFieldRequired,
        name: z.string().min(1).max(50).optional(),
        iconColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
      },
    },
    async ({ workspace, ...body }, extra) =>
      ok(await api("PATCH", `/api/workspaces/${workspace}`, tokenOf(extra), { body }))
  );

  server.registerTool(
    "add_member",
    {
      title: "メンバー追加",
      description:
        "既存ユーザーをユーザーID（username）でワークスペースに追加する（OWNER/ADMIN のみ）。role 省略時は MEMBER。相手は登録済みユーザーである必要がある。username は list_members で確認できる。",
      inputSchema: {
        workspace: workspaceFieldRequired,
        username: z.string().min(1).describe("追加するユーザーのユーザーID"),
        role: assignableRole.optional(),
      },
    },
    async ({ workspace, ...body }, extra) => {
      const token = tokenOf(extra);
      return ok(await api("POST", `${await wsBase(token, workspace)}/members`, token, { body }));
    }
  );

  server.registerTool(
    "update_member_role",
    {
      title: "メンバー役割変更",
      description:
        "メンバーの役割を ADMIN / MEMBER に変更する（OWNER/ADMIN のみ）。OWNER の役割は変更不可。userId は list_members で確認する。",
      inputSchema: {
        workspace: workspaceFieldRequired,
        userId: z.number().int().positive().describe("対象ユーザーID"),
        role: assignableRole,
      },
    },
    async ({ workspace, userId, role }, extra) => {
      const token = tokenOf(extra);
      return ok(
        await api("PATCH", `${await wsBase(token, workspace)}/members/${userId}`, token, {
          body: { role },
        })
      );
    }
  );

  server.registerTool(
    "remove_member",
    {
      title: "メンバー削除",
      description:
        "メンバーをワークスペースから外す（OWNER/ADMIN のみ）。OWNER は削除不可。担当タスクは未割当に戻る。userId は list_members で確認する。",
      inputSchema: {
        workspace: workspaceFieldRequired,
        userId: z.number().int().positive().describe("対象ユーザーID"),
      },
      annotations: { destructiveHint: true },
    },
    async ({ workspace, userId }, extra) => {
      const token = tokenOf(extra);
      await api("DELETE", `${await wsBase(token, workspace)}/members/${userId}`, token);
      return ok({ removed: userId, workspace });
    }
  );

  // --- コメント（タスク配下） ---

  server.registerTool(
    "list_comments",
    {
      title: "コメント一覧",
      description:
        "指定タスク（number）のコメントを古い順に取得する（投稿者情報付き）。number は list_tasks / get_task で調べる。既定以外のワークスペースのタスクは workspace も指定する。",
      inputSchema: {
        number: taskNumberField,
        workspace: workspaceField,
      },
      annotations: { readOnlyHint: true },
    },
    async ({ number, workspace }, extra) => {
      const token = tokenOf(extra);
      return ok(await api("GET", `${await wsBase(token, workspace)}/tasks/${number}/comments`, token));
    }
  );

  server.registerTool(
    "add_comment",
    {
      title: "コメント投稿",
      description:
        "指定タスク（number）にコメントを投稿する（メンバーなら誰でも可）。投稿者は接続アカウント。既定以外のワークスペースのタスクは workspace を指定する。",
      inputSchema: {
        number: taskNumberField,
        body: z.string().min(1).max(2000).describe("コメント本文"),
        workspace: workspaceField,
      },
    },
    async ({ number, body, workspace }, extra) => {
      const token = tokenOf(extra);
      return ok(
        await api("POST", `${await wsBase(token, workspace)}/tasks/${number}/comments`, token, {
          body: { body },
        })
      );
    }
  );

  server.registerTool(
    "update_comment",
    {
      title: "コメント編集",
      description:
        "コメント本文を編集する（投稿者本人 または OWNER/ADMIN のみ）。commentId は list_comments で調べる。既定以外のワークスペースのタスクは workspace を指定する。",
      inputSchema: {
        number: taskNumberField,
        commentId: z.number().int().positive().describe("対象コメントID"),
        body: z.string().min(1).max(2000).describe("新しいコメント本文"),
        workspace: workspaceField,
      },
    },
    async ({ number, commentId, body, workspace }, extra) => {
      const token = tokenOf(extra);
      return ok(
        await api("PATCH", `${await wsBase(token, workspace)}/tasks/${number}/comments/${commentId}`, token, {
          body: { body },
        })
      );
    }
  );

  server.registerTool(
    "delete_comment",
    {
      title: "コメント削除",
      description:
        "【破壊的】コメントを削除する（投稿者本人 または OWNER/ADMIN のみ）。取り消し不可。commentId は list_comments で調べる。既定以外のワークスペースのタスクは workspace を指定する。",
      inputSchema: {
        number: taskNumberField,
        commentId: z.number().int().positive().describe("対象コメントID"),
        workspace: workspaceField,
      },
      annotations: { destructiveHint: true },
    },
    async ({ number, commentId, workspace }, extra) => {
      const token = tokenOf(extra);
      await api("DELETE", `${await wsBase(token, workspace)}/tasks/${number}/comments/${commentId}`, token);
      return ok({ deleted: commentId });
    }
  );
}
