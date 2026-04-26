CREATE TYPE "MealOutcomeStatus" AS ENUM ('PLANNED', 'COOKED', 'SKIPPED', 'REPLACED', 'LEFTOVERS');

ALTER TABLE "Meal"
ADD COLUMN "outcomeStatus" "MealOutcomeStatus" NOT NULL DEFAULT 'PLANNED',
ADD COLUMN "outcomeNotes" TEXT,
ADD COLUMN "leftoverNotes" TEXT,
ADD COLUMN "actualCostCents" INTEGER,
ADD COLUMN "closedOutAt" TIMESTAMP(3),
ADD COLUMN "closedOutByUserId" TEXT;

CREATE INDEX "Meal_closedOutByUserId_idx" ON "Meal"("closedOutByUserId");
CREATE INDEX "Meal_outcomeStatus_idx" ON "Meal"("outcomeStatus");

ALTER TABLE "Meal" ADD CONSTRAINT "Meal_closedOutByUserId_fkey" FOREIGN KEY ("closedOutByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
