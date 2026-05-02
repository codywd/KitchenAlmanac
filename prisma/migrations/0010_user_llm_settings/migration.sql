-- CreateEnum
CREATE TYPE "LlmProviderKind" AS ENUM ('OPENAI_COMPATIBLE', 'ANTHROPIC_COMPATIBLE');

-- CreateTable
CREATE TABLE "UserLlmSettings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "providerKind" "LlmProviderKind" NOT NULL,
    "displayName" TEXT,
    "baseUrl" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "apiKeyCiphertext" TEXT NOT NULL,
    "apiKeyIv" TEXT NOT NULL,
    "apiKeyTag" TEXT NOT NULL,
    "keyFingerprint" TEXT NOT NULL,
    "lastVerifiedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserLlmSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserLlmSettings_userId_key" ON "UserLlmSettings"("userId");

-- CreateIndex
CREATE INDEX "UserLlmSettings_providerKind_idx" ON "UserLlmSettings"("providerKind");

-- CreateIndex
CREATE INDEX "UserLlmSettings_lastUsedAt_idx" ON "UserLlmSettings"("lastUsedAt");

-- AddForeignKey
ALTER TABLE "UserLlmSettings" ADD CONSTRAINT "UserLlmSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
