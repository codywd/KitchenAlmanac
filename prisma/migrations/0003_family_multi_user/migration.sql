CREATE TYPE "FamilyRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER');
CREATE TYPE "MealVoteValue" AS ENUM ('WANT', 'OKAY', 'NO');

CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FamilyMember" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "FamilyRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MealVote" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "vote" "MealVoteValue" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MealVote_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Family" ("id", "name", "createdAt", "updatedAt")
SELECT
    'family_' || "id",
    COALESCE(NULLIF("name", ''), split_part("email", '@', 1), 'Household') || ' Family',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User";

INSERT INTO "Family" ("id", "name", "createdAt", "updatedAt")
SELECT 'family_default', 'Household', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Family");

INSERT INTO "FamilyMember" ("id", "familyId", "userId", "role", "createdAt", "updatedAt")
SELECT
    'member_' || "id",
    'family_' || "id",
    "id",
    'OWNER',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "User";

ALTER TABLE "ApiKey" ADD COLUMN "familyId" TEXT;
ALTER TABLE "ApiKey" ADD COLUMN "createdByUserId" TEXT;
UPDATE "ApiKey"
SET
    "familyId" = 'family_' || "userId",
    "createdByUserId" = "userId";
ALTER TABLE "ApiKey" ALTER COLUMN "familyId" SET NOT NULL;

ALTER TABLE "Week" ADD COLUMN "familyId" TEXT;
UPDATE "Week"
SET "familyId" = 'family_' || "userId";
ALTER TABLE "Week" ALTER COLUMN "familyId" SET NOT NULL;

ALTER TABLE "HouseholdDocument" ADD COLUMN "familyId" TEXT;
UPDATE "HouseholdDocument"
SET "familyId" = (SELECT "id" FROM "Family" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1);
ALTER TABLE "HouseholdDocument" ALTER COLUMN "familyId" SET NOT NULL;

ALTER TABLE "RejectedMeal" ADD COLUMN "familyId" TEXT;
UPDATE "RejectedMeal" AS rejected
SET "familyId" = week."familyId"
FROM "Meal" AS meal
JOIN "DayPlan" AS day_plan ON day_plan."id" = meal."dayPlanId"
JOIN "Week" AS week ON week."id" = day_plan."weekId"
WHERE rejected."sourceMealId" = meal."id";

UPDATE "RejectedMeal" AS rejected
SET "familyId" = member."familyId"
FROM "FamilyMember" AS member
WHERE rejected."familyId" IS NULL
  AND rejected."createdByUserId" = member."userId";

UPDATE "RejectedMeal"
SET "familyId" = (SELECT "id" FROM "Family" ORDER BY "createdAt" ASC, "id" ASC LIMIT 1)
WHERE "familyId" IS NULL;

UPDATE "RejectedMeal" AS rejected
SET "createdByUserId" = NULL
WHERE "createdByUserId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "User" AS app_user
    WHERE app_user."id" = rejected."createdByUserId"
  );

ALTER TABLE "RejectedMeal" ALTER COLUMN "familyId" SET NOT NULL;

ALTER TABLE "ApiKey" DROP CONSTRAINT "ApiKey_userId_fkey";
DROP INDEX "ApiKey_userId_idx";
ALTER TABLE "ApiKey" DROP COLUMN "userId";

ALTER TABLE "Week" DROP CONSTRAINT "Week_userId_fkey";
DROP INDEX "Week_userId_weekStart_idx";
DROP INDEX "Week_userId_weekStart_key";
ALTER TABLE "Week" DROP COLUMN "userId";

DROP INDEX "HouseholdDocument_kind_key";

CREATE UNIQUE INDEX "FamilyMember_userId_key" ON "FamilyMember"("userId");
CREATE UNIQUE INDEX "FamilyMember_familyId_userId_key" ON "FamilyMember"("familyId", "userId");
CREATE INDEX "FamilyMember_familyId_idx" ON "FamilyMember"("familyId");
CREATE INDEX "FamilyMember_role_idx" ON "FamilyMember"("role");
CREATE INDEX "ApiKey_familyId_idx" ON "ApiKey"("familyId");
CREATE INDEX "ApiKey_createdByUserId_idx" ON "ApiKey"("createdByUserId");
CREATE UNIQUE INDEX "HouseholdDocument_familyId_kind_key" ON "HouseholdDocument"("familyId", "kind");
CREATE INDEX "HouseholdDocument_familyId_idx" ON "HouseholdDocument"("familyId");
CREATE UNIQUE INDEX "Week_familyId_weekStart_key" ON "Week"("familyId", "weekStart");
CREATE INDEX "Week_familyId_weekStart_idx" ON "Week"("familyId", "weekStart");
CREATE INDEX "RejectedMeal_familyId_idx" ON "RejectedMeal"("familyId");
CREATE INDEX "RejectedMeal_createdByUserId_idx" ON "RejectedMeal"("createdByUserId");
CREATE UNIQUE INDEX "MealVote_mealId_userId_key" ON "MealVote"("mealId", "userId");
CREATE INDEX "MealVote_userId_idx" ON "MealVote"("userId");

ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FamilyMember" ADD CONSTRAINT "FamilyMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HouseholdDocument" ADD CONSTRAINT "HouseholdDocument_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Week" ADD CONSTRAINT "Week_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RejectedMeal" ADD CONSTRAINT "RejectedMeal_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RejectedMeal" ADD CONSTRAINT "RejectedMeal_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "MealVote" ADD CONSTRAINT "MealVote_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MealVote" ADD CONSTRAINT "MealVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
