import { ArrowLeft, DollarSign, HeartPulse, Salad, TrendingUp } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { MealAnalyticsCharts } from "@/components/meal-analytics-charts";
import { PageIntro } from "@/components/page-intro";
import { Section } from "@/components/section";
import { formatMoney } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { requireFamilyContext } from "@/lib/family";
import { buildMealAnalytics } from "@/lib/meal-analytics";

export const dynamic = "force-dynamic";

function StatPanel({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof DollarSign;
  label: string;
  value: number | string;
}) {
  return (
    <div className="ka-panel border border-[var(--line)]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
          {label}
        </div>
        <Icon className="text-[var(--herb)]" size={18} />
      </div>
      <div className="mt-3 text-3xl font-black text-[var(--ink)]">{value}</div>
    </div>
  );
}

export default async function MealAnalyticsPage() {
  const context = await requireFamilyContext("/meal-memory/analytics");
  const weeks = await getDb().week.findMany({
    include: {
      days: {
        include: {
          dinner: true,
        },
        orderBy: {
          date: "asc",
        },
      },
    },
    orderBy: {
      weekStart: "desc",
    },
    take: 12,
    where: {
      familyId: context.family.id,
    },
  });
  const analytics = buildMealAnalytics({ weeks });

  return (
    <AppShell family={context.family} role={context.role} user={context.user}>
      <div className="ka-page">
        <PageIntro
          actions={
            <Link className="ka-button-secondary gap-2" href="/meal-memory">
              <ArrowLeft size={16} />
              Memory
            </Link>
          }
          eyebrow="Meal memory"
          title="Cost And Nutrition Analytics"
        >
          Trends from the last 12 family weeks. Nutrition values are imported
          planning estimates, not medical advice.
        </PageIntro>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <StatPanel
            icon={TrendingUp}
            label="Weeks"
            value={analytics.summary.weekCount}
          />
          <StatPanel
            icon={Salad}
            label="Dinners"
            value={analytics.summary.plannedDinners}
          />
          <StatPanel
            icon={DollarSign}
            label="Estimated"
            value={formatMoney(analytics.summary.estimatedCostCents)}
          />
          <StatPanel
            icon={DollarSign}
            label="Actual"
            value={formatMoney(analytics.summary.actualCostCents)}
          />
          <StatPanel
            icon={HeartPulse}
            label="Nutrition samples"
            value={analytics.summary.nutritionSampleCount}
          />
        </div>

        <Section title="Charts">
          <MealAnalyticsCharts analytics={analytics} />
        </Section>

        <div className="grid gap-5 xl:grid-cols-2">
          <Section title="Biggest Estimate Misses">
            {analytics.biggestEstimateMisses.length ? (
              <div className="ka-panel divide-y divide-[var(--line)]">
                {analytics.biggestEstimateMisses.map((meal) => (
                  <div className="py-4 first:pt-0 last:pb-0" key={meal.mealId}>
                    <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                      <div>
                        <h3 className="text-base font-black text-[var(--ink)]">
                          {meal.mealName}
                        </h3>
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
                          {meal.date}
                        </p>
                      </div>
                      <div className="text-sm font-black text-[var(--tomato-dark)]">
                        {formatMoney(meal.costDeltaCents)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-semibold text-[var(--muted-ink)]">
                Add actual costs during closeout to see estimate misses.
              </p>
            )}
          </Section>

          <Section title="Most Expensive Meals">
            {analytics.mostExpensiveMeals.length ? (
              <div className="ka-panel divide-y divide-[var(--line)]">
                {analytics.mostExpensiveMeals.map((meal) => (
                  <div className="py-4 first:pt-0 last:pb-0" key={meal.mealId}>
                    <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                      <div>
                        <h3 className="text-base font-black text-[var(--ink)]">
                          {meal.mealName}
                        </h3>
                        <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
                          {meal.date}
                        </p>
                      </div>
                      <div className="text-sm font-black text-[var(--herb-dark)]">
                        {formatMoney(meal.actualCostCents)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm font-semibold text-[var(--muted-ink)]">
                Actual-cost closeouts will populate this list.
              </p>
            )}
          </Section>
        </div>
      </div>
    </AppShell>
  );
}
