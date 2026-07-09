// タスク管理アプリの REST /api を Bearer トークンで叩く小さなクライアント。
// 設定は環境変数から読む（MCP クライアントの設定ファイルで渡す）:
//   TASKAPP_BASE_URL  例: http://localhost:8888（既定） / 本番は Render の URL
//   TASKAPP_TOKEN     個人アクセストークン（npm run token:create で発行）

const BASE_URL = (process.env.TASKAPP_BASE_URL ?? "http://localhost:8888").replace(/\/+$/, "");
const TOKEN = process.env.TASKAPP_TOKEN;

if (!TOKEN) {
  // stdio の MCP では stderr にログを出す（stdout はプロトコル用）。
  console.error(
    "環境変数 TASKAPP_TOKEN が未設定です。`npm run token:create -- --email <you> --label mcp` で発行し、MCP 設定の env に指定してください。"
  );
  process.exit(1);
}

// REST を呼び出す。非 2xx は API の統一エラー形式 { error: { message } } を Error にして投げる。
export async function api(
  method: string,
  path: string,
  body?: unknown
): Promise<unknown> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message =
      (data && (data as any).error?.message) || `HTTP ${res.status} ${res.statusText}`;
    throw new Error(message);
  }
  return data;
}

// クエリ文字列を組み立てる（undefined/null/空文字は除外）。
export function toQuery(params: Record<string, unknown>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
