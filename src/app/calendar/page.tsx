import {
  ArrowRight,
  CalendarPlus,
  CheckCircle2,
  ChefHat,
  CircleDashed,
  ClipboardCheck,
  ClipboardList,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";

import { createCurrentWeekAction, createWeekFromFormAction } from "@/app/meal-actions";
import { AppShell } from "@/components/app-shell";
import { PageIntro } from "@/components/page-intro";
import { Section } from "@/components/section";
import { MealVoteSummary } from "@/components/meal-vote-panel";
import { addDays, formatDisplayDate, formatMoney, startOfMealPlanWeek, toDateOnly } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { canManagePlans, requireFamilyContext } from "@/lib/family";

export const dynamic = "force-dynamic";

function validationScore(meal: {
  budgetFit: boolean;
  diabetesFriendly: boolean;
  heartHealthy: boolean;
  kidFriendly: boolean;
  noFishSafe: boolean;
  weeknightTimeSafe: boolean;
}) {
  return [
    meal.diabetesFriendly,
    meal.heartHealthy,
    meal.noFishSafe,
    meal.kidFriendly,
    meal.budgetFit,
    meal.weeknightTimeSafe,
  ].filter(Boolean).length;
}

export default async function CalendarPage() {
  const context = await requireFamilyContext("/calendar");
  const canManage = canManagePlans(context.role);
  const currentWeekStart = startOfMealPlanWeek();
  const weeks = await getDb().week.findMany({
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
    orderBy: {
      weekStart: "desc",
    },
    take: 8,
    where: {
      familyId: context.family.id,
    },
  });
  const selectedWeek =
    weeks.find((week) => toDateOnly(week.weekStart) === toDateOnly(currentWeekStart)) ??
    weeks[0];
  const daySlots = selectedWeek
    ? Array.from({ length: 7 }, (_, index) => {
        const date = addDays(selectedWeek.weekStart, index);
        const day = selectedWeek.days.find(
          (candidate) => toDateOnly(candidate.date) === toDateOnly(date),
        );

        return {
          date,
          day,
        };
      })
    : [];

  return (
    <AppShell family={context.family} role={context.role} user={context.user}>
      <div className="ka-page">
        <PageIntro
          actions={
            <>
            {canManage ? (
          <form action={createCurrentWeekAction}>
                <button className="ka-button gap-2">
              <CalendarPlus size={16} />
              Current week
            </button>
          </form>
            ) : null}
          {selectedWeek ? (
            <>
            <Link
                  className="ka-button-secondary gap-2"
              href={`/weeks/${selectedWeek.id}`}
            >
              Week detail
              <ArrowRight size={16} />
            </Link>
            <Link
                  className="ka-button-secondary gap-2"
              href={`/weeks/${selectedWeek.id}/review`}
            >
              Review
              <ClipboardCheck size={16} />
            </Link>
            <Link
                  className="ka-button-secondary gap-2"
              href={`/weeks/${selectedWeek.id}/shopping`}
            >
              Shopping
              <ShoppingCart size={16} />
            </Link>
            <Link
                  className="ka-button-secondary gap-2"
              href={`/weeks/${selectedWeek.id}/closeout`}
            >
              Closeout
              <ClipboardList size={16} />
            </Link>
            </>
          ) : null}
            </>
          }
          eyebrow="Dinner calendar"
          title={selectedWeek ? `Week of ${toDateOnly(selectedWeek.weekStart)}` : "No plan yet"}
        >
          The app stores the plan and feedback. The outside LLM reads the household
          guidance and writes meals through authenticated API calls.
        </PageIntro>

      <Section
        description="Direct visits land here after login. Days fill in as the API stores dinner plans."
        title="Planning Spread"
      >
        {selectedWeek ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
            {daySlots.map(({ date, day }) => {
              const meal = day?.dinner;

              return (
                <Link
                  className="calendar-tile ka-card block"
                  href={meal ? `/cook/${meal.id}` : `/weeks/${selectedWeek.id}`}
                  key={toDateOnly(date)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="whitespace-nowrap text-[0.68rem] font-extrabold uppercase tracking-[0.08em] text-[var(--muted-ink)]">
                        {toDateOnly(date)}
                      </div>
                      <div className="recipe-display mt-1 text-2xl font-semibold leading-none text-[var(--ink)]">
                        {formatDisplayDate(date)}
                      </div>
                    </div>
                    {meal ? (
                      <CheckCircle2 className="text-[var(--herb)]" size={19} />
                    ) : (
                      <CircleDashed className="text-[var(--muted-ink)]" size={19} />
                    )}
                  </div>
                  {meal ? (
                    <div className="mt-5">
                      <h3 className="text-base font-black leading-6 text-[var(--ink)]">
                        {meal.name}
                      </h3>
                      <p className="mt-2 text-sm font-semibold text-[var(--muted-ink)]">
                        {meal.cuisine ?? "Cuisine TBD"} / {formatMoney(meal.costEstimateCents)}
                      </p>
                      <div className="mt-4 h-1.5 bg-[rgba(62,42,24,0.16)]">
                        <div
                          className="h-1.5 bg-[var(--herb)] transition-[width] duration-500"
                          style={{ width: `${(validationScore(meal) / 6) * 100}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs font-bold text-[var(--muted-ink)]">
                        {validationScore(meal)}/6 validation flags claimed
                      </p>
                      <p className="ka-status-mark mt-4" data-tone="muted">
                        Feedback: {meal.feedbackStatus.replaceAll("_", " ").toLowerCase()}
                      </p>
                      <div className="mt-3">
                        <MealVoteSummary
                          currentUserId={context.user.id}
                          votes={meal.votes}
                        />
                      </div>
                      <p className="mt-3 inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.12em] text-[var(--tomato)]">
                        <ChefHat size={14} />
                        Cook view
                      </p>
                    </div>
                  ) : (
                    <div className="mt-8 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
                      No dinner stored for this day yet.
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="ka-panel border-dashed p-8 text-center">
            <p className="text-sm text-[var(--muted-ink)]">
              No weeks exist yet. Create one here or let the outside LLM create it
              through `POST /api/weeks`.
            </p>
          </div>
        )}
      </Section>

      {canManage ? (
      <Section title="Create A Specific Week">
        <form action={createWeekFromFormAction} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <input
            className="ka-field"
            defaultValue={toDateOnly(currentWeekStart)}
            name="weekStart"
            type="date"
          />
          <input
            className="ka-field"
            name="title"
            placeholder="Optional title"
          />
          <button className="ka-button-secondary">
            Create week
          </button>
        </form>
      </Section>
      ) : null}
      </div>
    </AppShell>
  );
}
