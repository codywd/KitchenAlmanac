import { getDb } from "./db";

export type SetupStatusInput = {
  activeApiKeyCount: number;
  activePantryStapleCount: number;
  activeRejectedMealCount: number;
  dinnerCount: number;
  householdDocumentCount: number;
  householdDocumentWithContentCount: number;
  latestWeekId?: string | null;
  memberCount: number;
  savedRecipeCount: number;
  weekCount: number;
};

export type SetupStepKey =
  | "family"
  | "guidance"
  | "api-key"
  | "first-plan"
  | "members"
  | "pantry"
  | "cookbook";

export type SetupStep = {
  actionLabel?: string;
  complete: boolean;
  detail: string;
  href?: string;
  key: SetupStepKey;
  metric: string;
  required: boolean;
  title: string;
};

export type SetupStatus = {
  completedRequiredCount: number;
  input: SetupStatusInput;
  isLaunchReady: boolean;
  requiredCount: number;
  steps: SetupStep[];
};

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function buildSetupStatus(
  input: SetupStatusInput,
  options: {
    canManage: boolean;
  },
): SetupStatus {
  const hasFamilyOwner = input.memberCount > 0;
  const hasGuidance = input.householdDocumentWithContentCount >= 3;
  const hasApiKey = input.activeApiKeyCount > 0;
  const hasFirstPlan = input.dinnerCount > 0;
  const canManage = options.canManage;
  const steps: SetupStep[] = [
    {
      actionLabel: canManage ? "Review family" : undefined,
      complete: hasFamilyOwner,
      detail: "Confirm the first owner account and household membership are in place.",
      href: canManage ? "/family" : undefined,
      key: "family",
      metric: pluralize(input.memberCount, "member"),
      required: true,
      title: "Family owner",
    },
    {
      actionLabel: canManage ? "Edit guidance" : undefined,
      complete: hasGuidance,
      detail: "Keep the household profile, medical guidance, and batch-prep patterns ready for planner context.",
      href: canManage ? "/household" : undefined,
      key: "guidance",
      metric: `${input.householdDocumentWithContentCount}/3 ready`,
      required: true,
      title: "Guidance seeded",
    },
    {
      actionLabel: canManage ? "Create key" : undefined,
      complete: hasApiKey,
      detail: "Create a family API key for outside planner and import tooling.",
      href: canManage ? "/api-keys" : undefined,
      key: "api-key",
      metric: pluralize(input.activeApiKeyCount, "active key", "active keys"),
      required: true,
      title: "API access",
    },
    {
      actionLabel: canManage ? "Plan first week" : undefined,
      complete: hasFirstPlan,
      detail: "Create a planning session, use ChatGPT, then import the first reviewed weekly JSON.",
      href: canManage ? "/planner" : undefined,
      key: "first-plan",
      metric: `${pluralize(input.weekCount, "week")} / ${pluralize(input.dinnerCount, "dinner")}`,
      required: true,
      title: "First week",
    },
    {
      actionLabel: canManage ? "Add members" : undefined,
      complete: input.memberCount > 1,
      detail: "Bring in the people who will vote, shop, cook, and close out meals.",
      href: canManage ? "/family" : undefined,
      key: "members",
      metric: pluralize(input.memberCount, "member"),
      required: false,
      title: "Household members",
    },
    {
      actionLabel: input.latestWeekId ? "Open shopping" : undefined,
      complete: input.activePantryStapleCount > 0,
      detail: "Add staples so shopping defaults can separate pantry items from things to buy.",
      href: input.latestWeekId ? `/weeks/${input.latestWeekId}/shopping` : undefined,
      key: "pantry",
      metric: pluralize(input.activePantryStapleCount, "active staple"),
      required: false,
      title: "Pantry defaults",
    },
    {
      actionLabel: input.savedRecipeCount > 0 ? "Open recipes" : undefined,
      complete: input.savedRecipeCount > 0,
      detail: "Save proven meals after closeout so future planning can reuse what worked.",
      href: "/recipes",
      key: "cookbook",
      metric: pluralize(input.savedRecipeCount, "saved recipe"),
      required: false,
      title: "Cookbook started",
    },
  ];
  const requiredSteps = steps.filter((step) => step.required);
  const completedRequiredCount = requiredSteps.filter((step) => step.complete).length;

  return {
    completedRequiredCount,
    input,
    isLaunchReady: completedRequiredCount === requiredSteps.length,
    requiredCount: requiredSteps.length,
    steps,
  };
}

export async function loadSetupStatus({
  canManage,
  familyId,
}: {
  canManage: boolean;
  familyId: string;
}) {
  const [
    activeApiKeyCount,
    activePantryStapleCount,
    activeRejectedMealCount,
    dinnerCount,
    householdDocuments,
    latestWeek,
    memberCount,
    savedRecipeCount,
    weekCount,
  ] = await Promise.all([
    getDb().apiKey.count({
      where: {
        familyId,
        revokedAt: null,
      },
    }),
    getDb().pantryStaple.count({
      where: {
        active: true,
        familyId,
      },
    }),
    getDb().rejectedMeal.count({
      where: {
        active: true,
        familyId,
      },
    }),
    getDb().meal.count({
      where: {
        dayPlan: {
          week: {
            familyId,
          },
        },
      },
    }),
    getDb().householdDocument.findMany({
      select: {
        content: true,
      },
      where: {
        familyId,
      },
    }),
    getDb().week.findFirst({
      orderBy: {
        weekStart: "desc",
      },
      select: {
        id: true,
      },
      where: {
        familyId,
      },
    }),
    getDb().familyMember.count({
      where: {
        familyId,
      },
    }),
    getDb().savedRecipe.count({
      where: {
        active: true,
        familyId,
      },
    }),
    getDb().week.count({
      where: {
        familyId,
      },
    }),
  ]);

  return buildSetupStatus(
    {
      activeApiKeyCount,
      activePantryStapleCount,
      activeRejectedMealCount,
      dinnerCount,
      householdDocumentCount: householdDocuments.length,
      householdDocumentWithContentCount: householdDocuments.filter(
        (document) => document.content.trim().length > 0,
      ).length,
      latestWeekId: latestWeek?.id ?? null,
      memberCount,
      savedRecipeCount,
      weekCount,
    },
    { canManage },
  );
}
