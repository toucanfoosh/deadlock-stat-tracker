-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('HERO', 'ITEM', 'RANK');

-- CreateTable
CREATE TABLE "Player" (
    "accountId" INTEGER NOT NULL,
    "steamId64" TEXT,
    "personaName" TEXT,
    "avatarUrl" TEXT,
    "mmrHistory" JSONB,
    "lastRefreshedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("accountId")
);

-- CreateTable
CREATE TABLE "Patch" (
    "patchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "releasedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Patch_pkey" PRIMARY KEY ("patchId")
);

-- CreateTable
CREATE TABLE "Match" (
    "matchId" BIGINT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "patchId" TEXT,
    "gameMode" INTEGER,
    "matchMode" INTEGER,
    "durationSec" INTEGER,
    "rawMetadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("matchId")
);

-- CreateTable
CREATE TABLE "MatchPlayer" (
    "id" TEXT NOT NULL,
    "matchId" BIGINT NOT NULL,
    "accountId" INTEGER NOT NULL,
    "heroId" INTEGER,
    "heroLevel" INTEGER,
    "playerTeam" INTEGER,
    "kills" INTEGER,
    "deaths" INTEGER,
    "assists" INTEGER,
    "lastHits" INTEGER,
    "denies" INTEGER,
    "netWorth" INTEGER,
    "soulsPerMinute" DOUBLE PRECISION,
    "damageDealt" INTEGER,
    "damageTaken" INTEGER,
    "objectiveDamage" INTEGER,
    "bossDamage" INTEGER,
    "healingDone" INTEGER,
    "win" BOOLEAN,
    "rankTier" TEXT,
    "rankDivision" INTEGER,
    "rankSubrank" INTEGER,
    "progressionCurve" JSONB,
    "itemBuild" JSONB,
    "abilityBuild" JSONB,
    "extraMetrics" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerAggregate" (
    "id" TEXT NOT NULL,
    "accountId" INTEGER NOT NULL,
    "filterHash" TEXT NOT NULL,
    "totalMatches" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "winRate" DOUBLE PRECISION NOT NULL,
    "avgKda" DOUBLE PRECISION NOT NULL,
    "avgNetWorth" DOUBLE PRECISION NOT NULL,
    "avgCs" DOUBLE PRECISION NOT NULL,
    "recentForm" JSONB,
    "perHero" JSONB,
    "mmrHistory" JSONB,
    "mateEnemy" JSONB,
    "progressionSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerAggregate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "assetId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "iconUrl" TEXT,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalStatsCache" (
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalStatsCache_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Match_startTime_idx" ON "Match"("startTime");

-- CreateIndex
CREATE INDEX "Match_patchId_idx" ON "Match"("patchId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchPlayer_matchId_accountId_key" ON "MatchPlayer"("matchId", "accountId");

-- CreateIndex
CREATE INDEX "MatchPlayer_accountId_heroId_idx" ON "MatchPlayer"("accountId", "heroId");

-- CreateIndex
CREATE INDEX "MatchPlayer_heroId_idx" ON "MatchPlayer"("heroId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerAggregate_accountId_filterHash_key" ON "PlayerAggregate"("accountId", "filterHash");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_type_assetId_key" ON "Asset"("type", "assetId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_patchId_fkey" FOREIGN KEY ("patchId") REFERENCES "Patch"("patchId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("matchId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchPlayer" ADD CONSTRAINT "MatchPlayer_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Player"("accountId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAggregate" ADD CONSTRAINT "PlayerAggregate_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Player"("accountId") ON DELETE CASCADE ON UPDATE CASCADE;
