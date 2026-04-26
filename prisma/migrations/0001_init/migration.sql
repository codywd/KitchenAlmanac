CREATE TYPE "MealFeedbackStatus" AS ENUM ('PLANNED', 'LIKED', 'WORKED_WITH_TWEAKS', 'REJECTED');
CREATE TYPE "HouseholdDocumentKind" AS ENUM ('HOUSEHOLD_PROFILE', 'MEDICAL_GUIDELINES', 'BATCH_PREP_PATTERNS');

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HouseholdDocument" (
    "id" TEXT NOT NULL,
    "kind" "HouseholdDocumentKind" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HouseholdDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Week" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "weekStart" TIMESTAMP(3) NOT NULL,
    "title" TEXT,
    "notes" TEXT,
    "budgetTargetCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Week_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DayPlan" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DayPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Meal" (
    "id" TEXT NOT NULL,
    "dayPlanId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cuisine" TEXT,
    "prepTimeActiveMinutes" INTEGER,
    "prepTimeTotalMinutes" INTEGER,
    "costEstimateCents" INTEGER,
    "servings" INTEGER NOT NULL DEFAULT 7,
    "ingredients" JSONB NOT NULL,
    "methodSteps" TEXT[],
    "kidAdaptations" TEXT,
    "batchPrepNote" TEXT,
    "diabetesFriendly" BOOLEAN NOT NULL DEFAULT false,
    "heartHealthy" BOOLEAN NOT NULL DEFAULT false,
    "noFishSafe" BOOLEAN NOT NULL DEFAULT false,
    "kidFriendly" BOOLEAN NOT NULL DEFAULT false,
    "budgetFit" BOOLEAN NOT NULL DEFAULT false,
    "weeknightTimeSafe" BOOLEAN NOT NULL DEFAULT false,
    "validationNotes" TEXT,
    "feedbackStatus" "MealFeedbackStatus" NOT NULL DEFAULT 'PLANNED',
    "feedbackReason" TEXT,
    "feedbackTweaks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Meal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GroceryList" (
    "id" TEXT NOT NULL,
    "weekId" TEXT NOT NULL,
    "sections" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GroceryList_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RejectedMeal" (
    "id" TEXT NOT NULL,
    "mealName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "patternToAvoid" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sourceMealId" TEXT,
    "createdByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RejectedMeal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");
CREATE INDEX "ApiKey_userId_idx" ON "ApiKey"("userId");
CREATE INDEX "ApiKey_keyPrefix_idx" ON "ApiKey"("keyPrefix");
CREATE UNIQUE INDEX "HouseholdDocument_kind_key" ON "HouseholdDocument"("kind");
CREATE UNIQUE INDEX "Week_userId_weekStart_key" ON "Week"("userId", "weekStart");
CREATE INDEX "Week_userId_weekStart_idx" ON "Week"("userId", "weekStart");
CREATE UNIQUE INDEX "DayPlan_weekId_date_key" ON "DayPlan"("weekId", "date");
CREATE INDEX "DayPlan_date_idx" ON "DayPlan"("date");
CREATE UNIQUE INDEX "Meal_dayPlanId_key" ON "Meal"("dayPlanId");
CREATE UNIQUE INDEX "GroceryList_weekId_key" ON "GroceryList"("weekId");
CREATE INDEX "RejectedMeal_active_idx" ON "RejectedMeal"("active");
CREATE INDEX "RejectedMeal_sourceMealId_idx" ON "RejectedMeal"("sourceMealId");

ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ApiKey" ADD CONSTRAINT "ApiKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Week" ADD CONSTRAINT "Week_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DayPlan" ADD CONSTRAINT "DayPlan_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_dayPlanId_fkey" FOREIGN KEY ("dayPlanId") REFERENCES "DayPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GroceryList" ADD CONSTRAINT "GroceryList_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "Week"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RejectedMeal" ADD CONSTRAINT "RejectedMeal_sourceMealId_fkey" FOREIGN KEY ("sourceMealId") REFERENCES "Meal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
