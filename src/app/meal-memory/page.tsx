import {
  ArrowRight,
  Brain,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  DollarSign,
  MessageSquareText,
  ThumbsDown,
  ThumbsUp,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import type { ElementType, ReactNode } from "react";

import {
  createRejectedMealAction,
  recordFeedbackAction,
} from "@/app/meal-actions";
import { AppShell } from "@/components/app-shell";
import { PageIntro } from "@/components/page-intro";
import { SaveRecipeButton } from "@/components/save-recipe-button";
import { Section } from "@/components/section";
import { formatMoney, toDateOnly } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { canManagePlans, requireFamilyContext } from "@/lib/family";
import {
  buildMealMemoryDashboard,
  type MealMemoryAvoidSignal,
  type MealMemoryInput,
  type MealMemoryRepeatCandidate,
  type MealMemoryTopWantedMeal,
} from "@/lib/meal-memory";

export const dynamic = "force-dynamic";

function signalLabel(source: MealMemoryAvoidSignal["source"]) {
  if (source === "feedback") {
    return "Feedback";
  }

  if (source === "vote") {
    return "Vote";
  }

  return "Rejected pattern";
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="ka-panel border-dashed p-6 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
      {children}
    </div>
  );
}

function StatPanel({
  icon: Icon,
  label,
  value,
}: {
  icon: ElementType;
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

function MarkLikedForm({ meal }: { meal: MealMemoryRepeatCandidate }) {
  return (
    <form action={recordFeedbackAction}>
      <input name="mealId" type="hidden" value={meal.mealId} />
      <input name="weekId" type="hidden" value={meal.weekId} />
      <input name="status" type="hidden" value="LIKED" />
      <input name="reason" type="hidden" value={meal.reason} />
      <input name="tweaks" type="hidden" value="" />
      <button className="ka-button-secondary gap-2">
        <ThumbsUp size={15} />
        Mark liked
      </button>
    </form>
  );
}

function RejectionPatternForm({ signal }: { signal: MealMemoryAvoidSignal }) {
  return (
    <form
      action={createRejectedMealAction}
      className="mt-4 grid gap-2 md:grid-cols-[1fr_auto]"
    >
      <input name="mealName" type="hidden" value={signal.mealName} />
      <input name="reason" type="hidden" value={signal.reason} />
      <input
        className="ka-field"
        defaultValue={signal.patternToAvoid ?? signal.mealName}
        name="patternToAvoid"
        placeholder="Pattern to avoid"
        required
      />
      <button className="ka-button-secondary gap-2">
        <ThumbsDown size={15} />
        Save pattern
      </button>
    </form>
  );
}

function WantedMealPanel({
  canManage,
  meal,
}: {
  canManage: boolean;
  meal: MealMemoryTopWantedMeal;
}) {
  return (
    <div className="ka-panel border border-[var(--line)]">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--herb-dark)]">
            {meal.lastServedDate}
          </div>
          <h3 className="mt-1 text-lg font-black text-[var(--ink)]">
            {meal.mealName}
          </h3>
          <p className="mt-2 text-sm font-semibold text-[var(--muted-ink)]">
            {meal.cuisine ?? "Cuisine TBD"} / {formatMoney(meal.costEstimateCents)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2 text-xs font-black uppercase tracking-[0.12em]">
          <span className="border-l-2 border-[var(--herb)] px-2 py-1 text-[var(--herb-dark)]">
            Want {meal.wantVotes}
          </span>
          <span className="border-l-2 border-[var(--tomato)] px-2 py-1 text-[var(--tomato-dark)]">
            No {meal.noVotes}
          </span>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link className="ka-button-secondary gap-2" href={`/cook/${meal.mealId}`}>
          Cook view
          <ArrowRight size={15} />
        </Link>
        <Link className="ka-button-secondary gap-2" href={`/weeks/${meal.weekId}`}>
          Week
          <CalendarDays size={15} />
        </Link>
        {canManage ? <SaveRecipeButton mealId={meal.mealId} /> : null}
      </div>
    </div>
  );
}

export default async function MealMemoryPage() {
  const context = await requireFamilyContext("/meal-memory");
  const canManage = canManagePlans(context.role);
  const [weeks, rejectedMeals] = await Promise.all([
    getDb().week.findMany({
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
            date: "desc",
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
    }),
    getDb().rejectedMeal.findMany({
      orderBy: {
        rejectedAt: "desc",
      },
      select: {
        active: true,
        mealName: true,
        patternToAvoid: true,
        reason: true,
        rejectedAt: true,
      },
      take: 50,
      where: {
        familyId: context.family.id,
      },
    }),
  ]);
  const input: MealMemoryInput = {
    meals: weeks.flatMap((week) =>
      week.days
        .filter((day) => day.dinner)
        .map((day) => {
          const meal = day.dinner!;

          return {
            actualCostCents: meal.actualCostCents,
            costEstimateCents: meal.costEstimateCents,
            cuisine: meal.cuisine,
            date: toDateOnly(day.date),
            feedbackReason: meal.feedbackReason,
            feedbackStatus: meal.feedbackStatus,
            feedbackTweaks: meal.feedbackTweaks,
            id: meal.id,
            leftoverNotes: meal.leftoverNotes,
            name: meal.name,
            outcomeNotes: meal.outcomeNotes,
            outcomeStatus: meal.outcomeStatus,
            votes: meal.votes,
            weekId: week.id,
          };
        }),
    ),
    rejectedMeals: rejectedMeals.map((meal) => ({
      active: meal.active,
      mealName: meal.mealName,
      patternToAvoid: meal.patternToAvoid,
      reason: meal.reason,
      rejectedAt: toDateOnly(meal.rejectedAt),
    })),
  };
  const dashboard = buildMealMemoryDashboard(input);

  return (
    <AppShell family={context.family} role={context.role} user={context.user}>
      <div className="ka-page">
        <PageIntro
          actions={
            canManage ? (
              <div className="flex flex-wrap gap-2">
                <Link className="ka-button gap-2" href="/planner">
                  Open planner
                  <ArrowRight size={16} />
                </Link>
                <Link className="ka-button-secondary gap-2" href="/recipes">
                  Recipes
                  <BookOpen size={16} />
                </Link>
              </div>
            ) : null
          }
          eyebrow="Meal memory"
          title="Household Preferences"
        >
          See what the family keeps asking for, what needs tweaks, and what should
          stay out of future plans.
        </PageIntro>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <StatPanel
            icon={CalendarDays}
            label="Recent meals"
            value={dashboard.stats.mealsReviewed}
          />
          <StatPanel
            icon={CheckCircle2}
            label="Cooked"
            value={dashboard.stats.cookedDinners}
          />
          <StatPanel
            icon={DollarSign}
            label="Actual cost"
            value={formatMoney(dashboard.stats.actualCostCents)}
          />
          <StatPanel
            icon={MessageSquareText}
            label="Votes"
            value={dashboard.stats.totalVotes}
          />
          <StatPanel
            icon={ThumbsUp}
            label="Want"
            value={dashboard.stats.wantVotes}
          />
          <StatPanel
            icon={ThumbsDown}
            label="No"
            value={dashboard.stats.noVotes}
          />
          <StatPanel
            icon={Brain}
            label="Liked"
            value={dashboard.stats.likedMeals}
          />
          <StatPanel
            icon={ThumbsDown}
            label="Active rejects"
            value={dashboard.stats.activeRejectedPatterns}
          />
        </div>

        <Section
          description="Meals with the strongest Want signals across the recent family history."
          title="Top Wanted Meals"
        >
          {dashboard.topWantedMeals.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {dashboard.topWantedMeals.map((meal) => (
                <WantedMealPanel
                  canManage={canManage}
                  key={meal.mealId}
                  meal={meal}
                />
              ))}
            </div>
          ) : (
            <EmptyState>No Want votes have been recorded yet.</EmptyState>
          )}
        </Section>

        <Section
          description="Good candidates to bring back or use as examples in the next planning brief."
          title="Bring Back Candidates"
        >
          {dashboard.repeatCandidates.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {dashboard.repeatCandidates.map((meal) => (
                <div className="ka-panel border border-[var(--line)]" key={meal.mealId}>
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--herb-dark)]">
                        Score {meal.score} / {meal.lastServedDate}
                      </div>
                      <h3 className="mt-1 text-lg font-black text-[var(--ink)]">
                        {meal.mealName}
                      </h3>
                      <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
                        {meal.reason}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2 text-xs font-black uppercase tracking-[0.12em]">
                      <span className="border-l-2 border-[var(--herb)] px-2 py-1 text-[var(--herb-dark)]">
                        W {meal.wantVotes}
                      </span>
                      <span className="border-l-2 border-[var(--brass)] px-2 py-1 text-[var(--muted-ink)]">
                        O {meal.okayVotes}
                      </span>
                      <span className="border-l-2 border-[var(--tomato)] px-2 py-1 text-[var(--tomato-dark)]">
                        N {meal.noVotes}
                      </span>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      className="ka-button-secondary gap-2"
                      href={`/cook/${meal.mealId}`}
                    >
                      Cook view
                      <ArrowRight size={15} />
                    </Link>
                    {canManage ? <MarkLikedForm meal={meal} /> : null}
                    {canManage ? <SaveRecipeButton mealId={meal.mealId} /> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>
              No repeat candidates yet. Votes and feedback will fill this in.
            </EmptyState>
          )}
        </Section>

        <Section
          description="Rejected feedback, No votes, and active rejected-meal patterns."
          title="Avoid Signals"
        >
          {dashboard.avoidSignals.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {dashboard.avoidSignals.map((signal) => (
                <div
                  className="ka-panel border border-[var(--line)]"
                  key={`${signal.source}-${signal.mealName}-${signal.reason}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="ka-status-mark bg-[rgba(186,79,58,0.12)] text-[var(--tomato-dark)]">
                      {signalLabel(signal.source)}
                    </span>
                    {signal.lastServedDate ? (
                      <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
                        {signal.lastServedDate}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-3 text-lg font-black text-[var(--ink)]">
                    {signal.mealName}
                  </h3>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
                    {signal.reason}
                  </p>
                  {signal.patternToAvoid ? (
                    <p className="mt-2 text-sm font-black text-[var(--tomato-dark)]">
                      Avoid: {signal.patternToAvoid}
                    </p>
                  ) : null}
                  {canManage && signal.source !== "rejected-pattern" ? (
                    <RejectionPatternForm signal={signal} />
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>No avoid signals have been recorded yet.</EmptyState>
          )}
        </Section>

        <div className="grid gap-5 xl:grid-cols-2">
          <Section title="Family Vote Patterns">
            {dashboard.memberPatterns.length ? (
              <div className="ka-panel divide-y divide-[var(--line)]">
                {dashboard.memberPatterns.map((member) => (
                  <div className="py-4 first:pt-0 last:pb-0" key={member.label}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <UsersRound className="text-[var(--herb)]" size={18} />
                        <h3 className="text-base font-black text-[var(--ink)]">
                          {member.label}
                        </h3>
                      </div>
                      <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
                        {member.total} votes / {member.comments} comments
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs font-black uppercase tracking-[0.12em]">
                      <span className="border-l-2 border-[var(--herb)] px-2 py-1 text-[var(--herb-dark)]">
                        Want {member.want}
                      </span>
                      <span className="border-l-2 border-[var(--brass)] px-2 py-1 text-[var(--muted-ink)]">
                        Okay {member.okay}
                      </span>
                      <span className="border-l-2 border-[var(--tomato)] px-2 py-1 text-[var(--tomato-dark)]">
                        No {member.no}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>No family votes have been recorded yet.</EmptyState>
            )}
          </Section>

          <Section title="Comment Themes">
            {dashboard.commentThemes.length ? (
              <div className="ka-panel divide-y divide-[var(--line)]">
                {dashboard.commentThemes.map((theme) => (
                  <div className="py-4 first:pt-0 last:pb-0" key={theme.theme}>
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-base font-black text-[var(--ink)]">
                        {theme.theme}
                      </h3>
                      <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
                        {theme.commentCount} notes
                      </span>
                    </div>
                    <div className="mt-3 space-y-3">
                      {theme.comments.slice(0, 3).map((comment) => (
                        <div key={`${theme.theme}-${comment.mealName}-${comment.text}`}>
                          <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--herb-dark)]">
                            {comment.label} / {comment.mealName}
                          </div>
                          <p className="mt-1 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
                            {comment.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState>No comments or feedback notes have been recorded yet.</EmptyState>
            )}
          </Section>
        </div>

        <Section title="Recent Worked Well Meals">
          {dashboard.workedWellMeals.length ? (
            <div className="ka-panel divide-y divide-[var(--line)]">
              {dashboard.workedWellMeals.map((meal) => (
                <div className="py-4 first:pt-0 last:pb-0" key={meal.mealId}>
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--herb-dark)]">
                        {meal.feedbackStatus.replaceAll("_", " ").toLowerCase()} /{" "}
                        {meal.lastServedDate}
                      </div>
                      <h3 className="mt-1 text-lg font-black text-[var(--ink)]">
                        {meal.mealName}
                      </h3>
                      {meal.feedbackReason ? (
                        <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
                          {meal.feedbackReason}
                        </p>
                      ) : null}
                      {meal.feedbackTweaks ? (
                        <p className="mt-2 text-sm font-black text-[var(--tomato-dark)]">
                          Tweak: {meal.feedbackTweaks}
                        </p>
                      ) : null}
                    </div>
                    <Link
                      className="ka-button-secondary gap-2"
                      href={`/cook/${meal.mealId}`}
                    >
                      Cook view
                      <ArrowRight size={15} />
                    </Link>
                    {canManage ? <SaveRecipeButton mealId={meal.mealId} /> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState>No liked or tweaked meals have been recorded yet.</EmptyState>
          )}
        </Section>
      </div>
    </AppShell>
  );
}
