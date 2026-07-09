import { randomBytes, createHash } from "node:crypto";

// 個人アクセストークン（PAT）のユーティリティ。
// トークンは検索のため決定的ハッシュ（SHA-256）で保存する。
// bcrypt はソルト付きで逆引きできず、リクエストごとの照合に不向きなため使わない
// （パスワードとは用途が異なる）。平文は発行時のみ表示し、DB にはハッシュだけ保存する。

// 新しいトークンを生成し、平文（raw）と保存用ハッシュ（hash）を返す。
export function generateToken(): { raw: string; hash: string } {
  // 識別しやすいよう pat_ 接頭辞を付ける。base64url は URL/ヘッダ安全な文字のみ。
  const raw = "pat_" + randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

// 任意の接頭辞で不透明トークンを生成する（PAT と同じ 32byte base64url + SHA-256）。
// リモート MCP の OAuth で認可コード/アクセス/リフレッシュを作り分けるのに使う
// （接頭辞例: mcp_ac_ / mcp_at_ / mcp_rt_）。平文は発行時のみ渡し、DB にはハッシュを保存する。
export function generateOpaqueToken(prefix: string): { raw: string; hash: string } {
  const raw = prefix + randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw) };
}

// 平文トークンから保存/照合用のハッシュ（16進）を計算する。
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}
