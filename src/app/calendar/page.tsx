import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Brain,
  CalendarPlus,
  ChefHat,
  CheckCircle2,
  CircleDashed,
  ClipboardCheck,
  ClipboardList,
  ListChecks,
  NotebookPen,
  Rocket,
  ShoppingCart,
} from "lucide-react";
import Link from "next/link";

import { createCurrentWeekAction, createWeekFromFormAction } from "@/app/meal-actions";
import { AppShell } from "@/components/app-shell";
import { PageIntro } from "@/components/page-intro";
import { Section } from "@/components/section";
import {
  formatMoney,
  startOfMealPlanWeek,
  toDateOnly,
} from "@/lib/dates";
import { getDb } from "@/lib/db";
import { canManagePlans, requireFamilyContext } from "@/lib/family";
import { loadSetupStatus } from "@/lib/setup";
import {
  buildWeekCommandCenterView,
  type WeekCommandCenterStage,
  type WeekCommandCenterStatus,
  type WeekCommandCenterView,
} from "@/lib/week-command-center";

export const dynamic = "force-dynamic";

const stageIcons = {
  closeout: ClipboardList,
  cook: ChefHat,
  learn: Brain,
  plan: NotebookPen,
  review: ClipboardCheck,
  shop: ShoppingCart,
} satisfies Record<WeekCommandCenterStage["id"], typeof Brain>;

const commandStatusIcons = {
  attention: AlertTriangle,
  blocked: CircleDashed,
  done: CheckCircle2,
  ready: CircleDashed,
} satisfies Record<WeekCommandCenterStatus, typeof AlertTriangle>;

const statusLabels = {
  attention: "Needs attention",
  blocked: "Blocked",
  done: "Done",
  ready: "Ready",
} satisfies Record<WeekCommandCenterStatus, string>;

function weekLabel(week: { title: string | null; weekStart: Date }) {
  return week.title ?? `Week of ${toDateOnly(week.weekStart)}`;
}

function CommandStageCard({ stage }: { stage: WeekCommandCenterStage }) {
  const Icon = stageIcons[stage.id];
  const StatusIcon = commandStatusIcons[stage.status];

  return (
    <article className="command-stage-card" data-status={stage.status}>
      <div className="flex items-start justify-between gap-3">
        <span className="command-stage-icon">
          <Icon size={19} />
        </span>
        <span className="command-status-pill" data-status={stage.status}>
          <StatusIcon size={14} />
          {statusLabels[stage.status]}
        </span>
      </div>
      <div className="mt-5">
        <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
          {stage.metric}
        </div>
        <h2 className="recipe-display mt-1 text-3xl font-semibold leading-none text-[var(--ink)]">
          {stage.title}
        </h2>
        <p className="mt-3 min-h-12 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
          {stage.detail}
        </p>
      </div>
      {stage.actionHref ? (
        <Link className="command-stage-action" href={stage.actionHref}>
          {stage.actionLabel}
          <ArrowRight size={15} />
        </Link>
      ) : (
        <span className="command-stage-action" data-disabled="true">
          {stage.actionLabel}
        </span>
      )}
    </article>
  );
}

function CommandDayCard({
  day,
}: {
  day: WeekCommandCenterView["days"][number];
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
            {day.displayDate}
          </div>
          <h3 className="mt-2 text-base font-black leading-6 text-[var(--ink)]">
            {day.mealName ?? "No dinner planned"}
          </h3>
        </div>
        {day.mealId ? (
          <ChefHat className="text-[var(--tomato)]" size={17} />
        ) : (
          <CircleDashed className="text-[var(--muted-ink)]" size={17} />
        )}
      </div>
      {day.mealId ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="ka-status-mark" data-tone="muted">
            {day.validationScore}/6 flags
          </span>
          <span className="ka-status-mark">
            {day.voteCounts.WANT} want
          </span>
          {day.voteCounts.NO > 0 ? (
            <span className="ka-status-mark" data-tone="danger">
              {day.voteCounts.NO} no
            </span>
          ) : null}
          {day.needsCloseout ? (
            <span className="ka-status-mark" data-tone="warm">
              closeout open
            </span>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (!day.mealId) {
    return (
      <div className="command-day-card" data-empty="true">
        {content}
      </div>
    );
  }

  return (
    <Link className="command-day-card" data-empty="false" href={`/cook/${day.mealId}`}>
      {content}
    </Link>
  );
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ weekId?: string }>;
}) {
  const context = await requireFamilyContext("/calendar");
  const params = await searchParams;
  const canManage = canManagePlans(context.role);
  const currentWeekStart = startOfMealPlanWeek();
  const [weeks, pantryStaples, activeRejectedMeals, setupStatus] =
    await Promise.all([
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
              date: "asc",
            },
          },
          groceryList: true,
          shoppingItemStates: {
            include: {
              updatedBy: {
                select: {
                  email: true,
                  name: true,
                },
              },
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
      }),
      getDb().pantryStaple.findMany({
        orderBy: {
          displayName: "asc",
        },
        select: {
          active: true,
          canonicalName: true,
          displayName: true,
        },
        where: {
          active: true,
          familyId: context.family.id,
        },
      }),
      getDb().rejectedMeal.findMany({
        orderBy: {
          rejectedAt: "desc",
        },
        select: {
          mealName: true,
          patternToAvoid: true,
          reason: true,
        },
        take: 50,
        where: {
          active: true,
          familyId: context.family.id,
        },
      }),
      canManage
        ? loadSetupStatus({
            canManage,
            familyId: context.family.id,
          })
        : Promise.resolve(null),
    ]);
  const selectedWeek =
    weeks.find((week) => week.id === params.weekId) ??
    weeks.find(
      (week) => toDateOnly(week.weekStart) === toDateOnly(currentWeekStart),
    ) ??
    weeks[0] ??
    null;
  const commandCenter = buildWeekCommandCenterView({
    activeRejectedMeals,
    canManage,
    pantryStaples,
    relatedWeeks: weeks,
    selectedWeek,
  });
  const nextAction = commandCenter.nextAction;

  return (
    <AppShell family={context.family} role={context.role} user={context.user}>
      <div className="ka-page">
        <PageIntro
          actions={
            weeks.length > 0 ? (
              <form
                action="/calendar"
                className="flex w-full min-w-0 max-w-lg flex-col gap-2 sm:flex-row"
              >
                <select
                  className="ka-select min-w-0 flex-1 sm:w-80"
                  defaultValue={selectedWeek?.id}
                  name="weekId"
                >
                  {weeks.map((week) => (
                    <option key={week.id} value={week.id}>
                      {weekLabel(week)} / {toDateOnly(week.weekStart)}
                    </option>
                  ))}
                </select>
                <button className="ka-button-secondary">
                  View week
                </button>
              </form>
            ) : null
          }
          eyebrow="Dinner command center"
          title="Week Command Center"
        >
          {commandCenter.selectedWeek
            ? `${commandCenter.selectedWeek.label} / ${commandCenter.selectedWeek.weekStart} through ${commandCenter.selectedWeek.weekEnd}`
            : "Plan the first household week, then the weekly workflow appears here."}
        </PageIntro>

        {setupStatus && !setupStatus.isLaunchReady ? (
          <Section
            description={`${setupStatus.completedRequiredCount}/${setupStatus.requiredCount} required setup checks complete.`}
            title="Finish Setup"
          >
            <div className="ka-panel flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <p className="text-sm font-semibold leading-6 text-[var(--muted-ink)]">
                Complete guidance, API access, and the first imported week before
                relying on production planning.
              </p>
              <Link className="ka-button gap-2" href="/setup">
                <Rocket size={16} />
                Open setup
              </Link>
            </div>
          </Section>
        ) : null}

        <section className="command-next-action">
          <div>
            <div className="ka-kicker">Next best action</div>
            <h2 className="recipe-display mt-2 text-4xl font-semibold leading-none text-[var(--ink)]">
              {nextAction.title}
            </h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
              {nextAction.detail}
            </p>
          </div>
          {nextAction.href ? (
            <Link className="ka-button gap-2 self-start md:self-center" href={nextAction.href}>
              {nextAction.label}
              <ArrowRight size={16} />
            </Link>
          ) : (
            <span className="ka-status-mark self-start md:self-center" data-tone="muted">
              {nextAction.label}
            </span>
          )}
        </section>

        <div className="command-stat-grid">
          <div className="command-stat">
            <span>Planned</span>
            <strong>{commandCenter.stats.plannedDinners}/7</strong>
          </div>
          <div className="command-stat">
            <span>Estimated cost</span>
            <strong>{formatMoney(commandCenter.stats.totalCostEstimateCents)}</strong>
          </div>
          <div className="command-stat">
            <span>Review warnings</span>
            <strong>{commandCenter.review.warningCount}</strong>
          </div>
          <div className="command-stat">
            <span>Shopping need</span>
            <strong>{commandCenter.shopping.neededCount}</strong>
          </div>
          <div className="command-stat">
            <span>Closeout due</span>
            <strong>{commandCenter.closeout.dueCount}</strong>
          </div>
        </div>

        <Section
          description="Plan, review, shop, cook, close out, and learn from the selected week."
          title="Weekly Flow"
        >
          <div className="command-stage-grid">
            {commandCenter.stages.map((stage) => (
              <CommandStageCard key={stage.id} stage={stage} />
            ))}
          </div>
        </Section>

        <Section
          description="Compact dinner status for the selected week."
          title="Dinner Strip"
        >
          {commandCenter.selectedWeek ? (
            <div className="command-day-strip">
              {commandCenter.days.map((day) => (
                <CommandDayCard day={day} key={day.date} />
              ))}
            </div>
          ) : (
            <div className="ka-panel border-dashed p-8 text-center">
              <p className="text-sm font-semibold text-[var(--muted-ink)]">
                No weeks exist yet.
              </p>
            </div>
          )}
        </Section>

        <Section title="Week Tools">
          <div className="command-tool-grid">
            {commandCenter.selectedWeek ? (
              <>
                <Link className="command-tool-link" href={`/weeks/${commandCenter.selectedWeek.id}`}>
                  <ClipboardList size={18} />
                  Week detail
                </Link>
                <Link className="command-tool-link" href={`/weeks/${commandCenter.selectedWeek.id}/review`}>
                  <ClipboardCheck size={18} />
                  Review and swap
                </Link>
                <Link className="command-tool-link" href={`/ingredients?weekId=${commandCenter.selectedWeek.id}`}>
                  <ListChecks size={18} />
                  Ingredients
                </Link>
                <Link className="command-tool-link" href={`/weeks/${commandCenter.selectedWeek.id}/shopping`}>
                  <ShoppingCart size={18} />
                  Shopping
                </Link>
                <Link className="command-tool-link" href={`/weeks/${commandCenter.selectedWeek.id}/closeout`}>
                  <ClipboardList size={18} />
                  Closeout
                </Link>
                <Link className="command-tool-link" href="/meal-memory">
                  <Brain size={18} />
                  Meal memory
                </Link>
                <Link className="command-tool-link" href="/recipes">
                  <BookOpen size={18} />
                  Recipes
                </Link>
              </>
            ) : null}
            {canManage ? (
              <>
                <Link className="command-tool-link" href="/planner">
                  <NotebookPen size={18} />
                  Planner
                </Link>
                <Link className="command-tool-link" href="/import">
                  <ArrowRight size={18} />
                  Manual import
                </Link>
              </>
            ) : null}
          </div>
        </Section>

        {canManage ? (
          <Section title="Create Week">
            <div className="grid gap-3 lg:grid-cols-[auto_minmax(0,1fr)]">
              <form action={createCurrentWeekAction}>
                <button className="ka-button gap-2 w-full">
                  <CalendarPlus size={16} />
                  Current week
                </button>
              </form>
              <form
                action={createWeekFromFormAction}
                className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"
              >
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
            </div>
          </Section>
        ) : null}
      </div>
    </AppShell>
  );
}
