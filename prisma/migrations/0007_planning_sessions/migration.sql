-- CreateEnum
CREATE TYPE "PlanningSessionStatus" AS ENUM ('DRAFT', 'PLAN_PASTED', 'IMPORTED');

-- CreateTable
CREATE TABLE "PlanningSession" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "budgetTargetCents" INTEGER,
    "localNotes" TEXT,
    "promptMarkdown" TEXT NOT NULL,
    "planJsonText" TEXT,
    "status" "PlanningSessionStatus" NOT NULL DEFAULT 'DRAFT',
    "importedWeekId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanningSession_familyId_weekStart_key" ON "PlanningSession"("familyId", "weekStart");

-- CreateIndex
CREATE INDEX "PlanningSession_familyId_idx" ON "PlanningSession"("familyId");

-- CreateIndex
CREATE INDEX "PlanningSession_weekStart_idx" ON "PlanningSession"("weekStart");

-- CreateIndex
CREATE INDEX "PlanningSession_status_idx" ON "PlanningSession"("status");

-- CreateIndex
CREATE INDEX "PlanningSession_importedWeekId_idx" ON "PlanningSession"("importedWeekId");

-- CreateIndex
CREATE INDEX "PlanningSession_createdByUserId_idx" ON "PlanningSession"("createdByUserId");

-- AddForeignKey
ALTER TABLE "PlanningSession" ADD CONSTRAINT "PlanningSession_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningSession" ADD CONSTRAINT "PlanningSession_importedWeekId_fkey" FOREIGN KEY ("importedWeekId") REFERENCES "Week"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningSession" ADD CONSTRAINT "PlanningSession_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
