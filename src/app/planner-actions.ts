"use server";

import { revalidatePath } from "next/cache";

import { parseDateOnly, toDateOnly } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { assertCanManagePlans, requireFamilyContext } from "@/lib/family";
import { buildImportReview, toImportReviewContext } from "@/lib/import-review";
import {
  getLatestFamilyBudgetTargetCents,
  loadPlanningBriefContext,
} from "@/lib/planning-brief";
import {
  toPlanningSessionView,
  type PlanningSessionView,
} from "@/lib/planning-session";
import { importMealPlanForFamily } from "@/lib/recipe-import-service";

export type PlanningSessionActionState = {
  error?: string;
  message?: string;
  session?: PlanningSessionView;
  weekId?: string;
};

function readText(formData: FormData, key: string) {
  return String(formData.get(key) ?? "");
}

function readTrimmedText(formData: FormData, key: string) {
  return readText(formData, key).trim();
}

function parseBudgetTargetCents(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Budget target cents must be a positive whole number.");
  }

  return parsed;
}

function readSessionFields(formData: FormData) {
  const weekStart = parseDateOnly(readTrimmedText(formData, "weekStart"));
  const budgetTargetCents = parseBudgetTargetCents(
    readTrimmedText(formData, "budgetTargetCents"),
  );
  const localNotes = readText(formData, "localNotes").trim();
  const promptMarkdown = readText(formData, "promptMarkdown");

  if (!promptMarkdown.trim()) {
    throw new Error("Generate the planning prompt before saving the session.");
  }

  return {
    budgetTargetCents,
    localNotes,
    promptMarkdown,
    weekStart,
  };
}

function revalidatePlanningSessionSurfaces(weekId?: string) {
  revalidatePath("/planner");
  revalidatePath("/import");

  if (weekId) {
    revalidatePath("/calendar");
    revalidatePath("/meal-memory");
    revalidatePath(`/weeks/${weekId}`);
  }
}

export async function savePlanningSessionPromptAction(
  _previousState: PlanningSessionActionState,
  formData: FormData,
): Promise<PlanningSessionActionState> {
  const context = await requireFamilyContext("/planner");
  assertCanManagePlans(context.role);

  try {
    const fields = readSessionFields(formData);
    const session = await getDb().planningSession.upsert({
      create: {
        ...fields,
        createdByUserId: context.user.id,
        familyId: context.family.id,
        importedWeekId: null,
        planJsonText: null,
        status: "DRAFT",
      },
      update: {
        budgetTargetCents: fields.budgetTargetCents,
        importedWeekId: null,
        localNotes: fields.localNotes,
        planJsonText: null,
        promptMarkdown: fields.promptMarkdown,
        status: "DRAFT",
      },
      where: {
        familyId_weekStart: {
          familyId: context.family.id,
          weekStart: fields.weekStart,
        },
      },
    });

    revalidatePlanningSessionSurfaces();

    return {
      message: `Saved planning prompt for ${toDateOnly(fields.weekStart)}.`,
      session: toPlanningSessionView(session),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not save the planning prompt.",
    };
  }
}

export async function savePlanningSessionPlanAction(
  _previousState: PlanningSessionActionState,
  formData: FormData,
): Promise<PlanningSessionActionState> {
  const context = await requireFamilyContext("/planner");
  assertCanManagePlans(context.role);

  try {
    const fields = readSessionFields(formData);
    const planJsonText = readText(formData, "planJsonText").trim();

    if (!planJsonText) {
      throw new Error("Paste the returned weekly JSON before saving.");
    }

    const session = await getDb().planningSession.upsert({
      create: {
        ...fields,
        createdByUserId: context.user.id,
        familyId: context.family.id,
        importedWeekId: null,
        planJsonText,
        status: "PLAN_PASTED",
      },
      update: {
        budgetTargetCents: fields.budgetTargetCents,
        importedWeekId: null,
        localNotes: fields.localNotes,
        planJsonText,
        promptMarkdown: fields.promptMarkdown,
        status: "PLAN_PASTED",
      },
      where: {
        familyId_weekStart: {
          familyId: context.family.id,
          weekStart: fields.weekStart,
        },
      },
    });

    revalidatePlanningSessionSurfaces();

    return {
      message: "Saved the returned JSON. Preview it before importing.",
      session: toPlanningSessionView(session),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not save the returned JSON.",
    };
  }
}

export async function importPlanningSessionAction(
  _previousState: PlanningSessionActionState,
  formData: FormData,
): Promise<PlanningSessionActionState> {
  const context = await requireFamilyContext("/planner");
  assertCanManagePlans(context.role);

  try {
    const sessionId = readTrimmedText(formData, "sessionId");

    if (!sessionId) {
      throw new Error("Save the planning session before importing.");
    }

    const session = await getDb().planningSession.findFirst({
      where: {
        familyId: context.family.id,
        id: sessionId,
      },
    });

    if (!session) {
      throw new Error("Planning session not found.");
    }

    if (!session.planJsonText?.trim()) {
      throw new Error("Paste and save the returned weekly JSON before importing.");
    }

    let plan: unknown;

    try {
      plan = JSON.parse(session.planJsonText);
    } catch {
      throw new Error("Returned weekly JSON must be valid JSON before importing.");
    }

    const planningContext = await loadPlanningBriefContext({
      familyId: context.family.id,
      weekStart: session.weekStart,
    });
    const fallbackBudgetTargetCents =
      session.budgetTargetCents ??
      (await getLatestFamilyBudgetTargetCents(context.family.id));
    const review = buildImportReview({
      context: toImportReviewContext({
        budgetTargetCents: fallbackBudgetTargetCents,
        planningContext,
      }),
      plan,
      weekStart: session.weekStart,
    });

    if (!review.canImport) {
      return {
        error: `Resolve import blockers before saving: ${review.blockingIssues
          .map((issue) => issue.title)
          .join(", ")}.`,
        session: toPlanningSessionView(session),
      };
    }

    const result = await importMealPlanForFamily({
      familyId: context.family.id,
      plan,
      weekStart: session.weekStart,
    });
    const updatedSession = await getDb().planningSession.update({
      data: {
        importedWeekId: result.week.id,
        status: "IMPORTED",
      },
      where: {
        id: session.id,
      },
    });

    revalidatePlanningSessionSurfaces(result.week.id);

    return {
      message: `Imported ${result.importedRecipeCount} recipes for ${toDateOnly(
        result.week.weekStart,
      )}.`,
      session: toPlanningSessionView(updatedSession),
      weekId: result.week.id,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not import the planning session.",
    };
  }
}
