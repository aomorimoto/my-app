-- 個人アクセストークン（Phase 7・レガシー）を撤去する。
-- リモート MCP + OAuth 2.1（Phase 8, OAuthAccessToken）に一本化済みのため不要。
DROP TABLE "PersonalAccessToken";
