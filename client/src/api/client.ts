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

// CSRF トークンのメモ化。初回のミューテーション時に /api/csrf から取得してキャッシュする。
let csrfToken: string | null = null;

async function getCsrfToken(): Promise<string> {
  if (csrfToken) return csrfToken;
  const res = await fetch("/api/csrf", { credentials: "include" });
  const data = await res.json().catch(() => null);
  const token: string = (data && data.csrfToken) || "";
  csrfToken = token;
  return token;
}

// 状態変更（非 GET）かつ auth 以外のリクエストは CSRF トークンが必要。
// auth（login/signup/logout）はサーバ側で CSRF 免除なのでトークンも付けない。
function needsCsrf(method: string, path: string): boolean {
  return method.toUpperCase() !== "GET" && !path.startsWith("/api/auth/");
}

// fetch の薄いラッパ。Cookie を送り、JSON を送受信し、失敗時は ApiError を投げる。
// 開発時は Vite プロキシ、本番は同一オリジンで /api に届く。
export async function apiFetch<T>(path: string, options: Options = {}): Promise<T> {
  const { method = "GET", body } = options;

  // CSRF が失効（ログアウト→再ログインでセッションが変わる等）していたら
  // トークンを取り直して 1 回だけ再試行する。
  const doFetch = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (needsCsrf(method, path)) headers["X-CSRF-Token"] = await getCsrfToken();

    return fetch(path, {
      method,
      credentials: "include",
      headers: Object.keys(headers).length ? headers : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch();

  if (res.status === 403 && needsCsrf(method, path)) {
    // トークンを捨てて取り直し、もう一度だけ試す
    csrfToken = null;
    res = await doFetch();
  }

  // 204 No Content（削除・ログアウト）は本文なし
  if (res.status === 204) return null as T;

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const err = (data && data.error) || {};
    throw new ApiError(res.status, err.code ?? "ERROR", err.message ?? "エラーが発生しました。");
  }

  return data as T;
}
