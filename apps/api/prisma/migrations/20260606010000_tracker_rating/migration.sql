-- AlterTable
ALTER TABLE "Player"
ADD COLUMN "trackerRating" DOUBLE PRECISION,
ADD COLUMN "trackerUpdatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MatchPlayer"
ADD COLUMN "queueCategory" TEXT,
ADD COLUMN "queueWeight" DOUBLE PRECISION,
ADD COLUMN "trackerBefore" DOUBLE PRECISION,
ADD COLUMN "trackerDelta" DOUBLE PRECISION,
ADD COLUMN "trackerAfter" DOUBLE PRECISION;
