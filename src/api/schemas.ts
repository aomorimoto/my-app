import { z } from "zod";

// 入力バリデーション用の zod スキーマ群。
// 空文字は「未指定（null）」として扱い、日付や数値は文字列からの変換にも対応する。

const statusEnum = z.enum(["TODO", "IN_PROGRESS", "DONE"]);
const priorityEnum = z.enum(["HIGH", "MEDIUM", "LOW"]);

// 期限: ISO 文字列 → Date、空文字/未指定 → null。
// 空文字だけを null に前処理し、未指定（undefined）はそのまま残す（PATCH で「変更なし」と区別するため）。
const dueDateField = z.preprocess(
  (v) => (v === "" ? null : v),
  z.coerce.date().nullable().optional()
);

// 担当者（ユーザー）ID: 数値文字列 → number、空文字 → null（未割当）。
const assigneeIdField = z.preprocess(
  (v) => (v === "" ? null : v),
  z.coerce.number().int().positive().nullable().optional()
);

// 担当エージェントID: 数値文字列 → number、空文字 → null（未割当）。assigneeIdField と同型。
const assigneeAgentIdField = z.preprocess(
  (v) => (v === "" ? null : v),
  z.coerce.number().int().positive().nullable().optional()
);

// 親タスクID: 数値文字列 → number、空文字 → null（トップレベル）。assigneeIdField と同型。
const parentIdField = z.preprocess(
  (v) => (v === "" ? null : v),
  z.coerce.number().int().positive().nullable().optional()
);

// タグID配列: 数値文字列も許容し number[] に変換。未指定はそのまま（PATCH で「変更なし」と区別）。
const tagIdsField = z.array(z.coerce.number().int().positive()).optional();

// メールアドレス（signup/login と同じ前処理）
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .email("メールアドレスの形式が正しくありません。");

// 説明: 空文字 → null。
const descriptionField = z.preprocess(
  (v) => (v === "" ? null : v),
  z.string().trim().max(2000).nullable().optional()
);

// --- 認証 ---

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("メールアドレスの形式が正しくありません。"),
  password: z.string().min(8, "パスワードは8文字以上にしてください。"),
  name: z.string().trim().max(100).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("メールアドレスの形式が正しくありません。"),
  password: z.string().min(1, "パスワードを入力してください。"),
});

// --- タスク ---

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "タイトルを入力してください。").max(200),
  description: descriptionField,
  status: statusEnum.optional(),
  priority: priorityEnum.optional(),
  dueDate: dueDateField,
  assigneeId: assigneeIdField,
  assigneeAgentId: assigneeAgentIdField,
  parentId: parentIdField,
  tagIds: tagIdsField,
});

// PATCH 用: 送られてきた項目だけ更新する（全項目を任意にする）。
export const taskUpdateSchema = taskCreateSchema.partial();

// 兄弟内の並べ替え（同一 parent のタスク id を表示順に並べた配列）。
// parentId 省略/空文字 = トップレベル（null）。
export const taskReorderSchema = z.object({
  parentId: parentIdField,
  order: z.array(z.coerce.number().int().positive()).min(1),
});

// --- 見た目（色・画像）共通フィールド ---

// #RRGGBB 形式の色（null 許容）。空文字は null（＝既定色に戻す）として扱う。
const hexColorField = z.preprocess(
  (v) => (v === "" ? null : v),
  z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "色は #RRGGBB 形式で指定してください。")
    .nullable()
    .optional()
);

// アバター/アイコン画像（data URI）。null 許容（＝画像を外す）。
// クライアントで 128px 前後に縮小して送る前提だが、念のためサイズ上限を設ける。
const imageDataUriField = z.preprocess(
  (v) => (v === "" ? null : v),
  z
    .string()
    .max(1_500_000, "画像サイズが大きすぎます。")
    .refine((s) => s.startsWith("data:image/"), "画像の形式が正しくありません。")
    .nullable()
    .optional()
);

// --- AI エージェント ---

export const agentCreateSchema = z.object({
  name: z.string().trim().min(1, "エージェント名を入力してください。").max(50),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "色は #RRGGBB 形式で指定してください。")
    .optional(),
  iconImage: imageDataUriField,
});

// PATCH 用: 送られてきた項目だけ更新する。
export const agentUpdateSchema = agentCreateSchema.partial();

// --- タグ ---

export const tagCreateSchema = z.object({
  name: z.string().trim().min(1, "タグ名を入力してください。").max(50),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "色は #RRGGBB 形式で指定してください。")
    .optional(),
});

// PATCH 用: 送られてきた項目だけ更新する。
export const tagUpdateSchema = tagCreateSchema.partial();

// --- コメント ---

export const commentCreateSchema = z.object({
  body: z.string().trim().min(1, "コメントを入力してください。").max(2000),
});

// 更新も本文のみ。
export const commentUpdateSchema = commentCreateSchema;

// --- ワークスペース / メンバー ---

// 付与できる役割（OWNER は作成者に固定・API から付与不可）
const assignableRoleEnum = z.enum(["ADMIN", "MEMBER"]);

export const workspaceCreateSchema = z.object({
  name: z.string().trim().min(1, "ワークスペース名を入力してください。").max(50),
});

// メイン画面のワークスペース並べ替え（表示順に並んだ workspaceId の配列）
export const workspaceReorderSchema = z.object({
  order: z.array(z.coerce.number().int().positive()).min(1),
});

// ワークスペース削除の確認。誤削除防止のため、対象のワークスペース名の再入力を必須にする。
export const workspaceDeleteSchema = z.object({
  name: z.string().trim().min(1, "確認のためワークスペース名を入力してください。"),
});

export const memberAddSchema = z.object({
  email: emailField,
  role: assignableRoleEnum.optional(), // 既定は MEMBER
});

export const memberRoleSchema = z.object({
  role: assignableRoleEnum,
});

// --- プロフィール / 見た目カスタマイズ ---

// 状態/優先度/期限の表示色設定。すべて任意の #RRGGBB。null で「その項目を既定に戻す」。
export const colorPrefsSchema = z
  .object({
    statusTodo: hexColorField,
    statusInProgress: hexColorField,
    statusDone: hexColorField,
    prioHigh: hexColorField,
    prioMedium: hexColorField,
    prioLow: hexColorField,
    due: hexColorField,
  })
  .partial();

// 自分のプロフィール更新（送られた項目のみ更新）。
export const userUpdateSchema = z.object({
  name: z.preprocess(
    (v) => (v === "" ? null : v),
    z.string().trim().max(100).nullable().optional()
  ),
  avatarColor: hexColorField,
  avatarImage: imageDataUriField,
  colorPrefs: colorPrefsSchema.nullable().optional(),
});

// ワークスペースの更新（名前・アイコン）。送られた項目のみ更新。
export const workspaceUpdateSchema = z.object({
  name: z.string().trim().min(1, "ワークスペース名を入力してください。").max(50).optional(),
  iconColor: hexColorField,
  iconImage: imageDataUriField,
});
