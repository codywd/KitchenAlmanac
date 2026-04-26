-- CreateTable
CREATE TABLE "SavedRecipe" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cuisine" TEXT,
    "ingredients" JSONB NOT NULL,
    "methodSteps" TEXT[],
    "servings" INTEGER NOT NULL DEFAULT 7,
    "costEstimateCents" INTEGER,
    "prepTimeActiveMinutes" INTEGER,
    "prepTimeTotalMinutes" INTEGER,
    "kidAdaptations" TEXT,
    "batchPrepNote" TEXT,
    "diabetesFriendly" BOOLEAN NOT NULL DEFAULT false,
    "heartHealthy" BOOLEAN NOT NULL DEFAULT false,
    "noFishSafe" BOOLEAN NOT NULL DEFAULT false,
    "kidFriendly" BOOLEAN NOT NULL DEFAULT false,
    "budgetFit" BOOLEAN NOT NULL DEFAULT false,
    "weeknightTimeSafe" BOOLEAN NOT NULL DEFAULT false,
    "validationNotes" TEXT,
    "sourceRecipe" JSONB,
    "sourceMealId" TEXT,
    "sourceMealName" TEXT,
    "sourceMealDate" TIMESTAMP(3),
    "sourceWeekId" TEXT,
    "sourceWeekStart" TIMESTAMP(3),
    "feedbackStatus" "MealFeedbackStatus",
    "feedbackReason" TEXT,
    "feedbackTweaks" TEXT,
    "outcomeStatus" "MealOutcomeStatus",
    "outcomeNotes" TEXT,
    "leftoverNotes" TEXT,
    "actualCostCents" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "archivedByUserId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SavedRecipe_familyId_sourceMealId_key" ON "SavedRecipe"("familyId", "sourceMealId");

-- CreateIndex
CREATE INDEX "SavedRecipe_familyId_idx" ON "SavedRecipe"("familyId");

-- CreateIndex
CREATE INDEX "SavedRecipe_active_idx" ON "SavedRecipe"("active");

-- CreateIndex
CREATE INDEX "SavedRecipe_sourceMealId_idx" ON "SavedRecipe"("sourceMealId");

-- CreateIndex
CREATE INDEX "SavedRecipe_createdByUserId_idx" ON "SavedRecipe"("createdByUserId");

-- CreateIndex
CREATE INDEX "SavedRecipe_updatedByUserId_idx" ON "SavedRecipe"("updatedByUserId");

-- CreateIndex
CREATE INDEX "SavedRecipe_archivedByUserId_idx" ON "SavedRecipe"("archivedByUserId");

-- AddForeignKey
ALTER TABLE "SavedRecipe" ADD CONSTRAINT "SavedRecipe_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedRecipe" ADD CONSTRAINT "SavedRecipe_sourceMealId_fkey" FOREIGN KEY ("sourceMealId") REFERENCES "Meal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedRecipe" ADD CONSTRAINT "SavedRecipe_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedRecipe" ADD CONSTRAINT "SavedRecipe_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedRecipe" ADD CONSTRAINT "SavedRecipe_archivedByUserId_fkey" FOREIGN KEY ("archivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
