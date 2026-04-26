import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChefHat,
  ClipboardCheck,
  ClipboardList,
  DollarSign,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { MealOutcomeForm } from "@/components/meal-outcome-form";
import { MealVotePanel } from "@/components/meal-vote-panel";
import { PageIntro } from "@/components/page-intro";
import { SaveRecipeButton } from "@/components/save-recipe-button";
import { Section } from "@/components/section";
import { addDays, formatDisplayDate, formatMoney, toDateOnly } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { canManagePlans, requireFamilyContext } from "@/lib/family";
import { buildWeekCloseout } from "@/lib/week-closeout";

export const dynamic = "force-dynamic";

function statusTone(outcomeStatus: string) {
  if (outcomeStatus === "COOKED" || outcomeStatus === "LEFTOVERS") {
    return "fresh";
  }

  if (outcomeStatus === "SKIPPED" || outcomeStatus === "REPLACED") {
    return "warm";
  }

  return "muted";
}

export default async function WeekCloseoutPage({
  params,
}: {
  params: Promise<{ weekId: string }>;
}) {
  const { weekId } = await params;
  const context = await requireFamilyContext(`/weeks/${weekId}/closeout`);
  const canManage = canManagePlans(context.role);
  const week = await getDb().week.findFirst({
    include: {
      days: {
        include: {
          dinner: {
            include: {
              votes: {
                include: {
                  user: {
                    select: {
                      email: true,
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
        orderBy: {
          date: "asc",
        },
      },
    },
    where: {
      familyId: context.family.id,
      id: weekId,
    },
  });

  if (!week) {
    notFound();
  }

  const daySlots = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(week.weekStart, index);
    const day = week.days.find(
      (candidate) => toDateOnly(candidate.date) === toDateOnly(date),
    );

    return {
      date,
      meal: day?.dinner ?? null,
    };
  });
  const closeout = buildWeekCloseout({
    budgetTargetCents: week.budgetTargetCents,
    days: daySlots.map((day) => ({
      date: toDateOnly(day.date),
      meal: day.meal,
    })),
    weekId: week.id,
    weekStart: toDateOnly(week.weekStart),
  });

  return (
    <AppShell family={context.family} role={context.role} user={context.user}>
      <div className="ka-page">
        <PageIntro
          actions={
            <div className="flex flex-wrap gap-2">
              <Link className="ka-button-secondary gap-2" href={`/weeks/${week.id}`}>
                Week detail
                <ArrowRight size={16} />
              </Link>
              <Link className="ka-button-secondary gap-2" href={`/weeks/${week.id}/review`}>
                Review
                <ClipboardCheck size={16} />
              </Link>
              <Link className="ka-button-secondary gap-2" href={`/weeks/${week.id}/shopping`}>
                Shopping
                <ShoppingCart size={16} />
              </Link>
              <Link className="ka-button-secondary gap-2" href="/recipes">
                Recipes
                <BookOpen size={16} />
              </Link>
            </div>
          }
          eyebrow="Week closeout"
          title={week.title ?? `Week of ${toDateOnly(week.weekStart)}`}
        >
          Capture what actually happened after dinner so meal memory and the next
          planning brief learn from real household outcomes.
        </PageIntro>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="ka-panel">
            <ClipboardList className="text-[var(--herb)]" size={20} />
            <div className="mt-3 text-3xl font-black text-[var(--ink)]">
              {closeout.stats.closedDinners}/{closeout.stats.plannedDinners}
            </div>
            <div className="text-sm font-semibold text-[var(--muted-ink)]">
              dinners closed
            </div>
          </div>
          <div className="ka-panel">
            <CheckCircle2 className="text-[var(--herb)]" size={20} />
            <div className="mt-3 text-3xl font-black text-[var(--ink)]">
              {closeout.stats.cookedDinners}
            </div>
            <div className="text-sm font-semibold text-[var(--muted-ink)]">
              cooked
            </div>
          </div>
          <div className="ka-panel">
            <ChefHat className="text-[var(--tomato)]" size={20} />
            <div className="mt-3 text-3xl font-black text-[var(--ink)]">
              {closeout.stats.unclosedDinners}
            </div>
            <div className="text-sm font-semibold text-[var(--muted-ink)]">
              need closeout
            </div>
          </div>
          <div className="ka-panel">
            <DollarSign className="text-[var(--herb)]" size={20} />
            <div className="mt-3 text-3xl font-black text-[var(--ink)]">
              {formatMoney(closeout.stats.actualCostCents)}
            </div>
            <div className="text-sm font-semibold text-[var(--muted-ink)]">
              actual cost
            </div>
          </div>
          <div className="ka-panel">
            <DollarSign className="text-[var(--tomato)]" size={20} />
            <div className="mt-3 text-3xl font-black text-[var(--ink)]">
              {formatMoney(closeout.stats.actualCostDeltaCents)}
            </div>
            <div className="text-sm font-semibold text-[var(--muted-ink)]">
              actual vs estimate
            </div>
          </div>
        </div>

        <Section
          description="Family members can still leave votes and comments. Owners/admins can save the closeout outcome that feeds future memory and planner briefs."
          title="Dinner Outcomes"
        >
          <div className="grid gap-4">
            {closeout.days.map((day) => {
              const meal = daySlots.find(
                (slot) => toDateOnly(slot.date) === day.date,
              )?.meal;

              return (
                <article className="ka-card p-5" key={day.date}>
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--muted-ink)]">
                        {formatDisplayDate(new Date(`${day.date}T00:00:00.000Z`))}
                      </div>
                      <h2 className="recipe-display mt-1 text-3xl font-semibold text-[var(--ink)]">
                        {day.mealName ?? "No dinner stored"}
                      </h2>
                      {day.mealName ? (
                        <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
                          {day.cuisine ?? "Cuisine TBD"} / {day.costSummary}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm font-semibold text-[var(--muted-ink)]">
                          Add or swap a dinner before closing out this day.
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className="ka-status-mark"
                        data-tone={statusTone(day.outcomeStatus)}
                      >
                        {day.outcomeLabel}
                      </span>
                      {meal ? (
                        <Link className="ka-button-secondary gap-2" href={`/cook/${meal.id}`}>
                          Cook
                          <ChefHat size={15} />
                        </Link>
                      ) : null}
                    </div>
                  </div>

                  {meal ? (
                    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
                      <div className="space-y-4">
                        {day.outcomeNotes || day.leftoverNotes ? (
                          <div className="grid gap-3 md:grid-cols-2">
                            {day.outcomeNotes ? (
                              <div className="border-l-2 border-[var(--herb)] pl-3 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
                                {day.outcomeNotes}
                              </div>
                            ) : null}
                            {day.leftoverNotes ? (
                              <div className="border-l-2 border-[var(--brass)] pl-3 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
                                {day.leftoverNotes}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        <MealVotePanel
                          currentUserId={context.user.id}
                          mealId={meal.id}
                          votes={meal.votes}
                        />
                      </div>
                      {canManage ? (
                        <div className="ka-panel">
                          <h3 className="recipe-display text-2xl font-semibold text-[var(--ink)]">
                            Save outcome
                          </h3>
                          <p className="mt-1 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
                            This writes the meal memory used by the next planning brief.
                          </p>
                          <div className="mt-4">
                            <MealOutcomeForm meal={meal} weekId={week.id} />
                          </div>
                          <div className="mt-3">
                            <SaveRecipeButton mealId={meal.id} />
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
