CREATE TYPE "ShoppingItemStatus" AS ENUM ('NEEDED', 'BOUGHT', 'ALREADY_HAVE');

CREATE TABLE "ShoppingItemState" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "quantity" TEXT,
    "status" "ShoppingItemStatus" NOT NULL DEFAULT 'NEEDED',
    "updatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShoppingItemState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PantryStaple" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "deactivatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PantryStaple_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShoppingItemState_weekId_canonicalName_key" ON "ShoppingItemState"("weekId", "canonicalName");
CREATE INDEX "ShoppingItemState_familyId_idx" ON "ShoppingItemState"("familyId");
CREATE INDEX "ShoppingItemState_weekId_idx" ON "ShoppingItemState"("weekId");
CREATE INDEX "ShoppingItemState_status_idx" ON "ShoppingItemState"("status");
CREATE INDEX "ShoppingItemState_updatedByUserId_idx" ON "ShoppingItemState"("updatedByUserId");

CREATE UNIQUE INDEX "PantryStaple_familyId_canonicalName_key" ON "PantryStaple"("familyId", "canonicalName");
CREATE INDEX "PantryStaple_familyId_idx" ON "PantryStaple"("familyId");
CREATE INDEX "PantryStaple_active_idx" ON "PantryStaple"("active");
CREATE INDEX "PantryStaple_createdByUserId_idx" ON "PantryStaple"("createdByUserId");
CREATE INDEX "PantryStaple_deactivatedByUserId_idx" ON "PantryStaple"("deactivatedByUserId");

ALTER TABLE "ShoppingItemState" ADD CONSTRAINT "ShoppingItemState_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShoppingItemState" ADD CONSTRAINT "ShoppingItemState_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ShoppingItemState" ADD CONSTRAINT "ShoppingItemState_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PantryStaple" ADD CONSTRAINT "PantryStaple_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PantryStaple" ADD CONSTRAINT "PantryStaple_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PantryStaple" ADD CONSTRAINT "PantryStaple_deactivatedByUserId_fkey" FOREIGN KEY ("deactivatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
