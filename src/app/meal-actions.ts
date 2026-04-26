"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordAuditEvent } from "@/lib/audit";
import { createApiKeyExpiryDate } from "@/lib/api-key-security";
import { createApiKeyMaterial } from "@/lib/auth";
import { addDays, parseDateOnly, startOfMealPlanWeek, toDateOnly } from "@/lib/dates";
import { getDb } from "@/lib/db";
import {
  assertCanManageApiKeys,
  assertCanManageGuidance,
  assertCanManagePlans,
  requireFamilyContext,
} from "@/lib/family";
import { buildRejectedMealFromFeedback, normalizeFeedbackStatus } from "@/lib/feedback";
import { buildImportReview, toImportReviewContext } from "@/lib/import-review";
import {
  getLatestFamilyBudgetTargetCents,
  loadPlanningBriefContext,
} from "@/lib/planning-brief";
import { parseJsonWithRepair } from "@/lib/json-repair";
import { assertRateLimit, rateLimitPolicies } from "@/lib/rate-limit";
import { normalizeImportedRecipe } from "@/lib/recipe-import";
import { importMealPlanForFamily } from "@/lib/recipe-import-service";
import { getActionRequestMetadata } from "@/lib/request-context";
import { apiKeyCreateSchema, rejectedMealCreateSchema } from "@/lib/schemas";

export type ApiKeyActionState = {
  error?: string;
  plainTextKey?: string;
};

export type ImportMealPlanActionState = {
  error?: string;
  message?: string;
  weekId?: string;
};

export type ReplaceDinnerActionState = {
  error?: string;
  mealId?: string;
  message?: string;
  weekId?: string;
};

export async function createCurrentWeekAction() {
  const context = await requireFamilyContext();
  assertCanManagePlans(context.role);
  const weekStart = startOfMealPlanWeek();
  const week = await getDb().week.upsert({
    create: {
      familyId: context.family.id,
      title: `Week of ${toDateOnly(weekStart)}`,
      weekStart,
    },
    update: {},
    where: {
      familyId_weekStart: {
        familyId: context.family.id,
        weekStart,
      },
    },
  });

  revalidatePath("/calendar");
  redirect(`/weeks/${week.id}`);
}

export async function createWeekFromFormAction(formData: FormData) {
  const context = await requireFamilyContext();
  assertCanManagePlans(context.role);
  const weekStart = parseDateOnly(String(formData.get("weekStart")));
  const title = String(formData.get("title") ?? "").trim() || null;

  const week = await getDb().week.upsert({
    create: {
      familyId: context.family.id,
      title,
      weekStart,
    },
    update: {
      title,
    },
    where: {
      familyId_weekStart: {
        familyId: context.family.id,
        weekStart,
      },
    },
  });

  revalidatePath("/calendar");
  redirect(`/weeks/${week.id}`);
}

export async function recordFeedbackAction(formData: FormData) {
  const context = await requireFamilyContext();
  assertCanManagePlans(context.role);
  const mealId = String(formData.get("mealId"));
  const weekId = String(formData.get("weekId"));
  const status = normalizeFeedbackStatus(String(formData.get("status")));
  const reason = String(formData.get("reason") ?? "").trim();
  const tweaks = String(formData.get("tweaks") ?? "").trim();
  const patternToAvoid = String(formData.get("patternToAvoid") ?? "").trim();
  const createRejectedPattern = formData.get("createRejectedPattern") === "on";

  const meal = await getDb().meal.findFirstOrThrow({
    where: {
      id: mealId,
      dayPlan: {
        week: {
          familyId: context.family.id,
        },
      },
    },
  });

  await getDb().meal.update({
    data: {
      feedbackReason: reason || null,
      feedbackStatus: status,
      feedbackTweaks: tweaks || null,
    },
    where: {
      id: meal.id,
    },
  });

  if (status === "REJECTED" && createRejectedPattern) {
    await getDb().rejectedMeal.create({
      data: {
        ...buildRejectedMealFromFeedback({
          mealName: meal.name,
          patternToAvoid,
          reason: reason || "Rejected from meal feedback.",
        }),
        createdByUserId: context.user.id,
        familyId: context.family.id,
        sourceMealId: meal.id,
      },
    });
  }

  revalidatePath(`/cook/${meal.id}`);
  revalidatePath(`/weeks/${weekId}`);
  revalidatePath(`/weeks/${weekId}/closeout`);
  revalidatePath("/calendar");
  revalidatePath("/meal-memory");
  revalidatePath("/rejected-meals");
}

export async function createRejectedMealAction(formData: FormData) {
  const context = await requireFamilyContext();
  assertCanManagePlans(context.role);
  const parsed = rejectedMealCreateSchema.safeParse({
    mealName: String(formData.get("mealName") ?? "").trim(),
    patternToAvoid: String(formData.get("patternToAvoid") ?? "").trim(),
    reason: String(formData.get("reason") ?? "").trim(),
  });

  if (!parsed.success) {
    throw new Error("Enter a meal name, reason, and pattern to avoid.");
  }

  await getDb().rejectedMeal.create({
    data: {
      ...parsed.data,
      createdByUserId: context.user.id,
      familyId: context.family.id,
    },
  });

  revalidatePath("/rejected-meals");
  revalidatePath("/meal-memory");
}

export async function toggleRejectedMealAction(formData: FormData) {
  const context = await requireFamilyContext();
  assertCanManagePlans(context.role);

  await getDb().rejectedMeal.updateMany({
    data: {
      active: formData.get("active") === "true",
    },
    where: {
      familyId: context.family.id,
      id: String(formData.get("id")),
    },
  });

  revalidatePath("/rejected-meals");
  revalidatePath("/meal-memory");
}

function parseRecipeJson(value: string) {
  try {
    return parseJsonWithRepair(value).value;
  } catch {
    throw new Error("Could not parse the replacement recipe JSON.");
  }
}

export async function replaceDinnerFromRecipeAction(
  _previousState: ReplaceDinnerActionState,
  formData: FormData,
): Promise<ReplaceDinnerActionState> {
  const context = await requireFamilyContext(
    `/weeks/${String(formData.get("weekId"))}/review`,
  );
  assertCanManagePlans(context.role);
  const weekId = String(formData.get("weekId"));
  const dateText = String(formData.get("date"));
  const recipeJson = String(formData.get("recipeJson") ?? "").trim();
  const date = parseDateOnly(dateText);
  let recipe: unknown;

  try {
    recipe = parseRecipeJson(recipeJson);
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid replacement recipe.",
    };
  }

  const week = await getDb().week.findFirst({
    select: {
      budgetTargetCents: true,
      id: true,
      weekStart: true,
    },
    where: {
      familyId: context.family.id,
      id: weekId,
    },
  });

  if (!week) {
    return {
      error: "Week not found.",
    };
  }

  const weekStart = toDateOnly(week.weekStart);
  const weekEnd = toDateOnly(addDays(week.weekStart, 6));

  if (dateText < weekStart || dateText > weekEnd) {
    return {
      error: "Replacement date must be inside the selected week.",
    };
  }

  try {
    const normalized = normalizeImportedRecipe({
      budgetTargetUsd:
        typeof week.budgetTargetCents === "number"
          ? week.budgetTargetCents / 100
          : undefined,
      date,
      recipe,
    });
    const meal = await getDb().$transaction(async (tx) => {
      const day = await tx.dayPlan.upsert({
        create: {
          date,
          weekId: week.id,
        },
        update: {},
        where: {
          weekId_date: {
            date,
            weekId: week.id,
          },
        },
      });

      await tx.meal.deleteMany({
        where: {
          dayPlanId: day.id,
        },
      });

      return tx.meal.create({
        data: {
          ...normalized.meal,
          actualCostCents: null,
          closedOutAt: null,
          closedOutByUserId: null,
          dayPlanId: day.id,
          feedbackReason: null,
          feedbackStatus: "PLANNED",
          feedbackTweaks: null,
          ingredients: normalized.meal.ingredients as Prisma.InputJsonValue,
          leftoverNotes: null,
          outcomeNotes: null,
          outcomeStatus: "PLANNED",
          sourceRecipe: normalized.meal.sourceRecipe as Prisma.InputJsonValue,
        },
      });
    });

    revalidatePath("/calendar");
    revalidatePath("/ingredients");
    revalidatePath("/meal-memory");
    revalidatePath(`/weeks/${week.id}`);
    revalidatePath(`/weeks/${week.id}/closeout`);
    revalidatePath(`/weeks/${week.id}/review`);

    return {
      mealId: meal.id,
      message: `Replaced dinner for ${dateText}. Ingredient rollup updated; stored grocery list may need refresh.`,
      weekId: week.id,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not replace that dinner.",
    };
  }
}

export async function saveHouseholdDocumentAction(formData: FormData) {
  const context = await requireFamilyContext();
  assertCanManageGuidance(context.role);

  await getDb().householdDocument.updateMany({
    data: {
      content: String(formData.get("content") ?? ""),
    },
    where: {
      familyId: context.family.id,
      id: String(formData.get("id")),
    },
  });

  revalidatePath("/household");
}

export async function createApiKeyAction(
  _previousState: ApiKeyActionState,
  formData: FormData,
): Promise<ApiKeyActionState> {
  const context = await requireFamilyContext();
  const requestMeta = await getActionRequestMetadata();
  assertCanManageApiKeys(context.role);
  const parsed = apiKeyCreateSchema.safeParse({
    expiresInDays: formData.get("expiresInDays") || "90",
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: "Name the API key before creating it." };
  }

  const { expiresInDays, name } = parsed.data;
  const material = createApiKeyMaterial(name);
  const expiresAt = createApiKeyExpiryDate(Number(expiresInDays) as 30 | 90 | 180);

  const key = await getDb().apiKey.create({
    data: {
      createdByUserId: context.user.id,
      expiresAt,
      familyId: context.family.id,
      keyHash: material.hash,
      keyPrefix: material.prefix,
      name: material.displayName,
    },
  });

  revalidatePath("/api-keys");
  await recordAuditEvent({
    actorUserId: context.user.id,
    familyId: context.family.id,
    metadata: {
      expiresAt: expiresAt.toISOString(),
      keyPrefix: material.prefix,
    },
    outcome: "success",
    requestMeta,
    subjectId: key.id,
    subjectType: "api-key",
    type: "api_key.create",
  });

  return {
    plainTextKey: material.plainTextKey,
  };
}

export async function revokeApiKeyAction(formData: FormData) {
  const context = await requireFamilyContext();
  const requestMeta = await getActionRequestMetadata();
  assertCanManageApiKeys(context.role);
  const id = String(formData.get("id"));

  await getDb().apiKey.updateMany({
    data: {
      revokedAt: new Date(),
    },
    where: {
      familyId: context.family.id,
      id,
    },
  });

  revalidatePath("/api-keys");
  await recordAuditEvent({
    actorUserId: context.user.id,
    familyId: context.family.id,
    outcome: "success",
    requestMeta,
    subjectId: id,
    subjectType: "api-key",
    type: "api_key.revoke",
  });
}

export async function importMealPlanAction(
  _previousState: ImportMealPlanActionState,
  formData: FormData,
): Promise<ImportMealPlanActionState> {
  const context = await requireFamilyContext("/import");
  const requestMeta = await getActionRequestMetadata();
  assertCanManagePlans(context.role);
  const weekStart = parseDateOnly(String(formData.get("weekStart")));
  const planJson = String(formData.get("planJson") ?? "");

  try {
    await assertRateLimit({
      actorUserId: context.user.id,
      familyId: context.family.id,
      policy: rateLimitPolicies.importPlan,
      requestMeta,
      scope: "import-plan-action",
      subject: `${context.family.id}:${context.user.id}`,
    });
    const plan = parseJsonWithRepair(planJson).value;
    const reviewContext = toImportReviewContext({
      budgetTargetCents: await getLatestFamilyBudgetTargetCents(context.family.id),
      planningContext: await loadPlanningBriefContext({
        familyId: context.family.id,
        weekStart,
      }),
    });
    const review = buildImportReview({
      context: reviewContext,
      plan,
      weekStart,
    });

    if (!review.canImport) {
      return {
        error: `Resolve import blockers before saving: ${review.blockingIssues
          .map((issue) => issue.title)
          .join(", ")}.`,
      };
    }

    const result = await importMealPlanForFamily({
      familyId: context.family.id,
      plan,
      weekStart,
    });

    revalidatePath("/calendar");
    revalidatePath("/import");
    revalidatePath("/meal-memory");
    revalidatePath(`/weeks/${result.week.id}`);
    await recordAuditEvent({
      actorUserId: context.user.id,
      familyId: context.family.id,
      outcome: "success",
      requestMeta,
      subjectId: result.week.id,
      subjectType: "week",
      type: "meal_plan.import",
    });

    return {
      message: `Imported ${result.importedRecipeCount} recipes for ${toDateOnly(
        result.week.weekStart,
      )}.`,
      weekId: result.week.id,
    };
  } catch (error) {
    await recordAuditEvent({
      actorUserId: context.user.id,
      familyId: context.family.id,
      outcome: "failure",
      requestMeta,
      type: "meal_plan.import",
    });
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not import that meal-plan JSON.",
    };
  }
}
