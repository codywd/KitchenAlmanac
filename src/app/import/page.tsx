import { AppShell } from "@/components/app-shell";
import { PageIntro } from "@/components/page-intro";
import { RecipeImportForm } from "@/components/recipe-import-form";
import { Section } from "@/components/section";
import { startOfMealPlanWeek, toDateOnly } from "@/lib/dates";
import { canManagePlans, requireFamilyContext } from "@/lib/family";
import { toImportReviewContext } from "@/lib/import-review";
import {
  getLatestFamilyBudgetTargetCents,
  loadPlanningBriefContext,
} from "@/lib/planning-brief";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const context = await requireFamilyContext("/import");
  const canManage = canManagePlans(context.role);
  const defaultWeekStart = startOfMealPlanWeek();
  const reviewContext = canManage
    ? toImportReviewContext({
        budgetTargetCents: await getLatestFamilyBudgetTargetCents(
          context.family.id,
        ),
        planningContext: await loadPlanningBriefContext({
          familyId: context.family.id,
          weekStart: defaultWeekStart,
        }),
      })
    : null;

  return (
    <AppShell family={context.family} role={context.role} user={context.user}>
      <div className="ka-page">
        <PageIntro eyebrow="Recipe import" title="Import weekly JSON">
          Paste the outside LLM&apos;s full weekly plan JSON. The importer stores
          the week, day-level dinners, recipe source objects, grocery list, prep
          notes, validation flags, and budget metadata.
        </PageIntro>

        {canManage ? (
          <Section
            description="The sample shape can be raw JSON, while API callers may also wrap it as { weekStart, plan }."
            title="Review Then Import"
          >
            <RecipeImportForm
              defaultWeekStart={toDateOnly(defaultWeekStart)}
              reviewContext={reviewContext!}
            />
          </Section>
        ) : (
          <Section title="Read Only">
            <p className="text-sm font-semibold leading-6 text-[var(--muted-ink)]">
              Family members can view meal plans and vote, while owners and admins
              import new weekly plans.
            </p>
          </Section>
        )}
      </div>
    </AppShell>
  );
}
