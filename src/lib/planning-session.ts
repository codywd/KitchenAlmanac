import { toDateOnly } from "./dates";
import { parseJsonWithRepair } from "./json-repair";

export type PlanningSessionStatusValue = "DRAFT" | "IMPORTED" | "PLAN_PASTED";

export type PlanningSessionView = {
  budgetTargetCents: number | null;
  createdAt: string;
  id: string;
  importedWeekId: string | null;
  localNotes: string;
  planJsonText: string;
  promptMarkdown: string;
  selectedMealIdeas: string;
  status: PlanningSessionStatusValue;
  updatedAt: string;
  weekStart: string;
};

export type PlanningSessionLike = {
  budgetTargetCents: number | null;
  createdAt: Date;
  id: string;
  importedWeekId: string | null;
  localNotes: string | null;
  planJsonText: string | null;
  promptMarkdown: string;
  selectedMealIdeas: string | null;
  status: PlanningSessionStatusValue;
  updatedAt: Date;
  weekStart: Date;
};

function optionalLocalNotesSection(localNotes: string) {
  const trimmedNotes = localNotes.trim();

  return trimmedNotes ? ["## Local Notes", trimmedNotes] : [];
}

function outputContract() {
  return [
    "## Requested Output",
    "Create one dinner plan for each date in the target week. Return only JSON that this app can import at `/import` or `POST /api/import/meal-plan`.",
    "Required top-level shape:",
    "```json",
    JSON.stringify(
      {
        input_summary: {
          assumptions: [],
          budget_target_usd: 0,
          constraints: [],
          family_size: 0,
        },
        recipes: [
          {
            day: "Monday",
            dinner_title: "Recipe name",
            estimated_cost_usd: 0,
            ingredients: [],
            instructions: [],
            servings: 7,
            tags: [],
            time: {
              prep_minutes: 0,
              total_minutes: 0,
            },
            why_this_works: "",
          },
        ],
        schema_version: "1.0",
        shopping_list: {},
        weekly_overview: {
          budget_status: "",
          coordination_strategy: [],
          estimated_total_grocery_cost_usd: 0,
          prep_ahead: [],
          theme: "",
        },
      },
      null,
      2,
    ),
    "```",
  ].join("\n\n");
}

export function buildMealIdeaPrompt({
  briefMarkdown,
  localNotes,
}: {
  briefMarkdown: string;
  localNotes: string;
}) {
  return [
    "# Phase 1: Meal Idea Brainstorm",
    "Use ChatGPT Thinking to brainstorm candidate dinners for the target week from the planning source material.",
    "Return meal ideas only. For each idea include Name, Overview, and Why it fits. Do not write full recipes, ingredient lists, cooking instructions, shopping lists, or JSON.",
    ...optionalLocalNotesSection(localNotes),
    "## Planning Source Material",
    briefMarkdown.trim(),
  ].join("\n\n");
}

export function buildPlanningSessionPrompt({
  briefMarkdown,
  localNotes,
  selectedMealIdeas = "",
}: {
  briefMarkdown: string;
  localNotes: string;
  selectedMealIdeas?: string;
}) {
  const trimmedIdeas = selectedMealIdeas.trim();

  return [
    "# Phase 2: Recipe Design And Import JSON",
    "Use the selected meal ideas as the menu direction, then design complete recipes that fit the planning source material.",
    "Keep the spirit of the selected ideas, but adjust anything that conflicts with household guidance, allergies, budget, timing, pantry staples, recent votes, or active rejected patterns.",
    ...optionalLocalNotesSection(localNotes),
    "## Selected Meal Ideas",
    trimmedIdeas ||
      "No selected meal ideas were provided. Choose the strongest meal directions from the planning source material.",
    "## Planning Source Material",
    briefMarkdown.trim(),
    outputContract(),
  ].join("\n\n");
}

export function normalizePlanningJsonText(value: string) {
  try {
    return parseJsonWithRepair(value).text;
  } catch {
    return value.trim();
  }
}

export function planningJsonTextsMatch(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const normalizedLeft = normalizePlanningJsonText(left ?? "");
  const normalizedRight = normalizePlanningJsonText(right ?? "");

  return Boolean(normalizedLeft) && normalizedLeft === normalizedRight;
}

export function toPlanningSessionView(
  session: PlanningSessionLike,
): PlanningSessionView {
  return {
    budgetTargetCents: session.budgetTargetCents,
    createdAt: session.createdAt.toISOString(),
    id: session.id,
    importedWeekId: session.importedWeekId,
    localNotes: session.localNotes ?? "",
    planJsonText: session.planJsonText ?? "",
    promptMarkdown: session.promptMarkdown,
    selectedMealIdeas: session.selectedMealIdeas ?? "",
    status: session.status,
    updatedAt: session.updatedAt.toISOString(),
    weekStart: toDateOnly(session.weekStart),
  };
}
