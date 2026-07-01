// API のエラー。集約エラーハンドラが返す { error: { message, code } } を保持する。
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

interface Options {
  method?: string;
  body?: unknown;
}

// fetch の薄いラッパ。Cookie を送り、JSON を送受信し、失敗時は ApiError を投げる。
// 開発時は Vite プロキシ、本番は同一オリジンで /api に届く。
export async function apiFetch<T>(path: string, options: Options = {}): Promise<T> {
  const { method = "GET", body } = options;

  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 204 No Content（削除・ログアウト）は本文なし
  if (res.status === 204) return null as T;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const err = (data && data.error) || {};
    throw new ApiError(res.status, err.code ?? "ERROR", err.message ?? "エラーが発生しました。");
  }

  return data as T;
}
