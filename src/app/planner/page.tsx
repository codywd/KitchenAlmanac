import { ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { PageIntro } from "@/components/page-intro";
import { PlanningSessionWorkspace } from "@/components/planning-session-workspace";
import { Section } from "@/components/section";
import { formatMoney } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { canManagePlans, requireFamilyContext } from "@/lib/family";
import { toImportReviewContext } from "@/lib/import-review";
import {
  buildPlanningBriefResponse,
  getLatestFamilyBudgetTargetCents,
  loadPlanningBriefContext,
  parsePlanningBriefQuery,
} from "@/lib/planning-brief";
import { toPlanningSessionView } from "@/lib/planning-session";

export const dynamic = "force-dynamic";

function urlSearchParamsFromRecord(record: {
  budgetTargetCents?: string;
  weekStart?: string;
}) {
  const params = new URLSearchParams();

  if (record.weekStart !== undefined) {
    params.set("weekStart", record.weekStart);
  }

  if (record.budgetTargetCents !== undefined) {
    params.set("budgetTargetCents", record.budgetTargetCents);
  }

  return params;
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Invalid planning brief filters.";
}

export default async function PlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ budgetTargetCents?: string; weekStart?: string }>;
}) {
  const familyContext = await requireFamilyContext("/planner");
  const canGenerate = canManagePlans(familyContext.role);
  const params = await searchParams;

  if (!canGenerate) {
    return (
      <AppShell
        family={familyContext.family}
        role={familyContext.role}
        user={familyContext.user}
      >
        <div className="ka-page">
          <PageIntro eyebrow="Planning brief" title="Next Week Builder">
            Owners and admins can generate the household planning brief. Members
            can still view shared plans, grocery lists, guidance, and vote on meals.
          </PageIntro>
          <Section title="Owner/Admin Only">
            <p className="text-sm leading-6 text-[var(--muted-ink)]">
              Ask a family owner or admin to generate the next brief and import the
              returned weekly JSON.
            </p>
          </Section>
        </div>
      </AppShell>
    );
  }

  const defaultBudgetTargetCents = await getLatestFamilyBudgetTargetCents(
    familyContext.family.id,
  );
  let parseError: string | null = null;
  let query;

  try {
    query = parsePlanningBriefQuery(urlSearchParamsFromRecord(params), {
      defaultBudgetTargetCents,
    });
  } catch (error) {
    parseError = readErrorMessage(error);
    query = parsePlanningBriefQuery(new URLSearchParams(), {
      defaultBudgetTargetCents,
    });
  }

  const context = await loadPlanningBriefContext({
    familyId: familyContext.family.id,
    weekStart: query.weekStart,
  });
  const response = buildPlanningBriefResponse({
    budgetTargetCents: query.budgetTargetCents,
    context,
    family: familyContext.family,
    generatedAt: new Date().toISOString(),
    weekStart: query.weekStart,
  });
  const planningSession = await getDb().planningSession.findUnique({
    where: {
      familyId_weekStart: {
        familyId: familyContext.family.id,
        weekStart: query.weekStart,
      },
    },
  });
  const reviewContext = toImportReviewContext({
    budgetTargetCents: query.budgetTargetCents,
    planningContext: context,
  });

  return (
    <AppShell
      family={familyContext.family}
      role={familyContext.role}
      user={familyContext.user}
    >
      <div className="ka-page">
        <PageIntro
          actions={
            <Link className="ka-button-secondary gap-2" href="/import">
              Manual import
              <ArrowRight size={16} />
            </Link>
          }
          eyebrow="Planning brief"
          title="Next Week Builder"
        >
          Save a family-scoped planning session, copy the ChatGPT prompt, then
          review and import the returned weekly JSON.
        </PageIntro>

        {parseError ? (
          <div className="ka-error text-sm font-semibold">{parseError}</div>
        ) : null}

        <Section
          description="The brief is derived on demand from current family guidance, votes, comments, rejected meals, recent meals, and grocery history."
          title="Brief Inputs"
        >
          <form action="/planner" className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
            <label className="block">
              <span className="ka-label">Target week</span>
              <input
                className="ka-field"
                defaultValue={response.weekStart}
                name="weekStart"
                type="date"
              />
            </label>
            <label className="block">
              <span className="ka-label">Budget target cents</span>
              <input
                className="ka-field"
                defaultValue={query.budgetTargetCents ?? ""}
                min={1}
                name="budgetTargetCents"
                placeholder="Uses latest saved week budget"
                step={1}
                type="number"
              />
            </label>
            <button className="ka-button gap-2 self-end">
              <RefreshCw size={16} />
              Generate
            </button>
          </form>
        </Section>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="ka-panel border border-[var(--line)]">
            <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
              Target week
            </div>
            <div className="mt-2 text-xl font-black text-[var(--ink)]">
              {response.weekStart} / {response.weekEnd}
            </div>
          </div>
          <div className="ka-panel border border-[var(--line)]">
            <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
              Budget
            </div>
            <div className="mt-2 text-xl font-black text-[var(--ink)]">
              {formatMoney(query.budgetTargetCents)}
            </div>
          </div>
          <div className="ka-panel border border-[var(--line)]">
            <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
              Signals
            </div>
            <div className="mt-2 text-xl font-black text-[var(--ink)]">
              {context.recentVotes.length} votes /{" "}
              {context.activeRejectedMeals.length} rejections
            </div>
          </div>
          <div className="ka-panel border border-[var(--line)]">
            <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
              History
            </div>
            <div className="mt-2 text-xl font-black text-[var(--ink)]">
              {context.recentMeals.length} meals /{" "}
              {context.recentIngredientSignals.length} ingredients /{" "}
              {context.pantryStaples.length} staples
            </div>
          </div>
        </div>

        <Section
          description="The saved session keeps the exact copied prompt and returned JSON so the manual ChatGPT handoff can survive page reloads."
          title="Planning Session"
        >
          <PlanningSessionWorkspace
            briefMarkdown={response.briefMarkdown}
            budgetTargetCents={query.budgetTargetCents}
            generatedAt={response.generatedAt}
            initialSession={
              planningSession ? toPlanningSessionView(planningSession) : null
            }
            reviewContext={reviewContext}
            weekEnd={response.weekEnd}
            weekStart={response.weekStart}
          />
        </Section>
      </div>
    </AppShell>
  );
}
