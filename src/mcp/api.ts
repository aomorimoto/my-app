// 同一プロセス内の REST /api をループバックで叩く小さなクライアント。
// リモート MCP のツールから、OAuth アクセストークンを Bearer として転送して呼ぶ。
// これにより、既存ルートの検証・ワークスペーススコープ・CSRF 免除（Bearer は免除）を
// そのまま再利用できる（middleware.ts の authenticate が OAuth トークンも userId に解決する）。
//
// Phase 16: API は URL 駆動。対象ワークスペースは path の /api/w/:wsPublicId/... で示すため、
// このクライアントは X-Workspace-Id ヘッダを扱わない（path が全てを決める）。

// アプリ自身が listen しているポート。127.0.0.1 に閉じてプロキシを介さない内部呼び出しにする。
const BASE_URL = `http://127.0.0.1:${process.env.PORT || 8888}`;

// REST を呼び出す。非 2xx は API の統一エラー形式 { error: { message } } を Error にして投げる。
export async function api(
  method: string,
  path: string,
  token: string,
  opts: { body?: unknown } = {}
): Promise<unknown> {
  const { body } = opts;
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
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

// 対象ワークスペースの publicId を決める。指定があればそれを使い、無ければ接続アカウントの
// 先頭（既定）ワークスペースを所属一覧から引く（従来の「省略時は先頭WS」の挙動を維持する）。
export async function resolveWorkspacePublicId(
  token: string,
  workspace: string | undefined
): Promise<string> {
  if (workspace) return workspace;
  const data = (await api("GET", "/api/workspaces", token)) as {
    workspaces?: { publicId: string }[];
  };
  const first = data.workspaces?.[0]?.publicId;
  if (!first) throw new Error("所属するワークスペースがありません。");
  return first;
}
