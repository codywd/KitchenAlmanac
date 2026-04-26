import { toDateOnly } from "./dates";

export type PlanningSessionStatusValue = "DRAFT" | "IMPORTED" | "PLAN_PASTED";

export type PlanningSessionView = {
  budgetTargetCents: number | null;
  createdAt: string;
  id: string;
  importedWeekId: string | null;
  localNotes: string;
  planJsonText: string;
  promptMarkdown: string;
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
  status: PlanningSessionStatusValue;
  updatedAt: Date;
  weekStart: Date;
};

export function buildPlanningSessionPrompt({
  briefMarkdown,
  localNotes,
}: {
  briefMarkdown: string;
  localNotes: string;
}) {
  const trimmedNotes = localNotes.trim();

  if (!trimmedNotes) {
    return briefMarkdown;
  }

  return `## Local Notes\n\n${trimmedNotes}\n\n${briefMarkdown}`;
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
    status: session.status,
    updatedAt: session.updatedAt.toISOString(),
    weekStart: toDateOnly(session.weekStart),
  };
}
