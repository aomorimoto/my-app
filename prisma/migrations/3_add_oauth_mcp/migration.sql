-- CreateTable
CREATE TABLE "OAuthClient" (
    "id" SERIAL NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretHash" TEXT,
    "clientSecretExpiresAt" TIMESTAMP(3),
    "redirectUris" TEXT[],
    "tokenEndpointAuthMethod" TEXT,
    "clientName" TEXT,
    "scope" TEXT,
    "grantTypes" TEXT[],
    "responseTypes" TEXT[],
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OAuthAuthorizationCode" (
    "codeHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "codeChallenge" TEXT NOT NULL,
    "scopes" TEXT[],
    "resource" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAuthorizationCode_pkey" PRIMARY KEY ("codeHash")
);

-- CreateTable
CREATE TABLE "OAuthAccessToken" (
    "tokenHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "scopes" TEXT[],
    "resource" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthAccessToken_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateTable
CREATE TABLE "OAuthRefreshToken" (
    "tokenHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "scopes" TEXT[],
    "resource" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthRefreshToken_pkey" PRIMARY KEY ("tokenHash")
);

-- CreateIndex
CREATE UNIQUE INDEX "OAuthClient_clientId_key" ON "OAuthClient"("clientId");

-- CreateIndex
CREATE INDEX "OAuthAuthorizationCode_userId_idx" ON "OAuthAuthorizationCode"("userId");

-- CreateIndex
CREATE INDEX "OAuthAccessToken_userId_idx" ON "OAuthAccessToken"("userId");

-- CreateIndex
CREATE INDEX "OAuthAccessToken_expiresAt_idx" ON "OAuthAccessToken"("expiresAt");

-- CreateIndex
CREATE INDEX "OAuthRefreshToken_userId_idx" ON "OAuthRefreshToken"("userId");

-- AddForeignKey
ALTER TABLE "OAuthAuthorizationCode" ADD CONSTRAINT "OAuthAuthorizationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthAccessToken" ADD CONSTRAINT "OAuthAccessToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OAuthRefreshToken" ADD CONSTRAINT "OAuthRefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

