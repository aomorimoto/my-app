import type {
  OAuthServerProvider,
} from "@modelcontextprotocol/sdk/server/auth/provider.js";
import type { OAuthRegisteredClientsStore } from "@modelcontextprotocol/sdk/server/auth/clients.js";
import type {
  OAuthClientInformationFull,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import {
  InvalidGrantError,
  InvalidTokenError,
} from "@modelcontextprotocol/sdk/server/auth/errors.js";
import { prisma } from "../db";
import { generateOpaqueToken, hashToken } from "../domain/token";

// 自前の OAuth 2.1 認可サーバ実装（Prisma 永続化）。
// PAT と同じく、認可コード/トークンは平文を保存せず SHA-256 ハッシュで逆引きする。
// アクセストークンは最終的に userId に解決され、既存の authenticate → /api の
// 認可（ワークスペーススコープ・所有権チェック）にそのまま合流する。design.md §8。

const AUTH_CODE_TTL_MS = 60 * 1000; // 認可コード: 60 秒（単回使用）
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // アクセストークン: 1 時間
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // リフレッシュトークン: 30 日

// アクセス＋リフレッシュを発行し、DB にハッシュ保存して OAuthTokens を返す共通処理。
async function issueTokens(args: {
  clientId: string;
  userId: number;
  scopes: string[];
  resource: string | null;
}): Promise<OAuthTokens> {
  const access = generateOpaqueToken("mcp_at_");
  const refresh = generateOpaqueToken("mcp_rt_");
  const now = Date.now();

  await prisma.oAuthAccessToken.create({
    data: {
      tokenHash: access.hash,
      clientId: args.clientId,
      userId: args.userId,
      scopes: args.scopes,
      resource: args.resource,
      expiresAt: new Date(now + ACCESS_TOKEN_TTL_MS),
    },
  });
  await prisma.oAuthRefreshToken.create({
    data: {
      tokenHash: refresh.hash,
      clientId: args.clientId,
      userId: args.userId,
      scopes: args.scopes,
      resource: args.resource,
      expiresAt: new Date(now + REFRESH_TOKEN_TTL_MS),
    },
  });

  return {
    access_token: access.raw,
    token_type: "bearer",
    expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    refresh_token: refresh.raw,
    scope: args.scopes.length > 0 ? args.scopes.join(" ") : undefined,
  };
}

// 登録済みクライアントの読み書き（動的クライアント登録 RFC 7591）。
const clientsStore: OAuthRegisteredClientsStore = {
  async getClient(clientId) {
    const row = await prisma.oAuthClient.findUnique({ where: { clientId } });
    // 保存済みの full 情報をそのまま返す（公開クライアントは client_secret を持たない）。
    return row ? (row.metadata as OAuthClientInformationFull) : undefined;
  },

  async registerClient(client) {
    // register ハンドラは client_id / client_id_issued_at を採番してから本メソッドを呼ぶ
    // （型では Omit されているが実体には含まれるためキャストする）。
    const full = client as OAuthClientInformationFull;
    await prisma.oAuthClient.create({
      data: {
        clientId: full.client_id,
        // 公開/PKCE クライアントは secret 無し。万一 confidential なら記録用にハッシュのみ保持。
        clientSecretHash: full.client_secret ? hashToken(full.client_secret) : null,
        clientSecretExpiresAt: full.client_secret_expires_at
          ? new Date(full.client_secret_expires_at * 1000)
          : null,
        redirectUris: full.redirect_uris ?? [],
        tokenEndpointAuthMethod: full.token_endpoint_auth_method ?? null,
        clientName: full.client_name ?? null,
        scope: full.scope ?? null,
        grantTypes: full.grant_types ?? [],
        responseTypes: full.response_types ?? [],
        metadata: full as object, // 登録レスポンスの往復のため丸ごと保持
      },
    });
    // 返した値がそのまま 201 のレスポンスボディになる。
    return full;
  },
};

export const oauthProvider: OAuthServerProvider = {
  get clientsStore() {
    return clientsStore;
  },

  // 認可エンドポイント本体。SDK は res のみ渡す（Express は res.req に元リクエストを持つ）。
  async authorize(client, params, res) {
    const req = res.req;

    // 未ログインなら既存の SPA ログインへ誘導し、ログイン後に /authorize へ復帰させる。
    // （session Cookie は sameSite=lax。トップレベル GET 遷移で復帰するため送信される）
    if (!req.session?.userId) {
      res.redirect(302, "/login?returnTo=" + encodeURIComponent(req.originalUrl));
      return;
    }

    // ログイン済み → ファーストパーティのため同意画面なしで即コード発行（自動承認）。
    const { raw, hash } = generateOpaqueToken("mcp_ac_");
    await prisma.oAuthAuthorizationCode.create({
      data: {
        codeHash: hash,
        clientId: client.client_id,
        userId: req.session.userId,
        redirectUri: params.redirectUri,
        codeChallenge: params.codeChallenge,
        scopes: params.scopes ?? [],
        resource: params.resource?.href ?? null,
        expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
      },
    });

    const redirect = new URL(params.redirectUri);
    redirect.searchParams.set("code", raw);
    if (params.state !== undefined) redirect.searchParams.set("state", params.state);
    res.redirect(302, redirect.href);
  },

  // 認可時に使われた code_challenge を返す（SDK がこれで PKCE(S256) を検証する）。
  async challengeForAuthorizationCode(client, authorizationCode) {
    const row = await prisma.oAuthAuthorizationCode.findUnique({
      where: { codeHash: hashToken(authorizationCode) },
    });
    if (!row || row.clientId !== client.client_id || row.expiresAt < new Date()) {
      throw new InvalidGrantError("認可コードが無効か期限切れです。");
    }
    return row.codeChallenge;
  },

  // 認可コード → アクセス/リフレッシュトークン交換（コードは単回使用）。
  async exchangeAuthorizationCode(client, authorizationCode, _codeVerifier, redirectUri) {
    const codeHash = hashToken(authorizationCode);
    const row = await prisma.oAuthAuthorizationCode.findUnique({ where: { codeHash } });
    if (!row || row.clientId !== client.client_id || row.expiresAt < new Date()) {
      throw new InvalidGrantError("認可コードが無効か期限切れです。");
    }
    if (redirectUri !== undefined && redirectUri !== row.redirectUri) {
      throw new InvalidGrantError("redirect_uri が一致しません。");
    }
    // 単回使用: 交換時に削除する（再利用攻撃を防ぐ）。
    await prisma.oAuthAuthorizationCode.delete({ where: { codeHash } });
    return issueTokens({
      clientId: row.clientId,
      userId: row.userId,
      scopes: row.scopes,
      resource: row.resource,
    });
  },

  // リフレッシュトークン → 新アクセストークン（リフレッシュはローテーションする）。
  async exchangeRefreshToken(client, refreshToken, scopes) {
    const tokenHash = hashToken(refreshToken);
    const row = await prisma.oAuthRefreshToken.findUnique({ where: { tokenHash } });
    if (
      !row ||
      row.clientId !== client.client_id ||
      (row.expiresAt !== null && row.expiresAt < new Date())
    ) {
      throw new InvalidGrantError("リフレッシュトークンが無効か期限切れです。");
    }
    // ローテーション: 旧リフレッシュを破棄し、新しい組を発行する。
    await prisma.oAuthRefreshToken.delete({ where: { tokenHash } });
    return issueTokens({
      clientId: row.clientId,
      userId: row.userId,
      // スコープ縮小要求があれば尊重、無ければ元のスコープを引き継ぐ。
      scopes: scopes && scopes.length > 0 ? scopes : row.scopes,
      resource: row.resource,
    });
  },

  // アクセストークン検証。userId を extra に載せて返す（後段でツールが利用）。
  async verifyAccessToken(token) {
    const tokenHash = hashToken(token);
    const row = await prisma.oAuthAccessToken.findUnique({ where: { tokenHash } });
    if (!row) throw new InvalidTokenError("アクセストークンが無効です。");
    if (row.expiresAt < new Date()) {
      await prisma.oAuthAccessToken.delete({ where: { tokenHash } }).catch(() => {});
      throw new InvalidTokenError("アクセストークンの有効期限が切れています。");
    }
    const info: AuthInfo = {
      token,
      clientId: row.clientId,
      scopes: row.scopes,
      // requireBearerAuth は expiresAt（秒）が有限数でないと拒否する。必須。
      expiresAt: Math.floor(row.expiresAt.getTime() / 1000),
      resource: row.resource ? new URL(row.resource) : undefined,
      extra: { userId: row.userId },
    };
    return info;
  },

  // トークン失効（access / refresh どちらでも）。実装すると /revoke が有効になる。
  async revokeToken(_client, request) {
    const tokenHash = hashToken(request.token);
    await prisma.oAuthAccessToken.deleteMany({ where: { tokenHash } });
    await prisma.oAuthRefreshToken.deleteMany({ where: { tokenHash } });
  },
};
