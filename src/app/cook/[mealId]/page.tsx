import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ChefHat,
  ClipboardList,
  Clock3,
  DollarSign,
  HeartPulse,
  Salad,
  UsersRound,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { recordFeedbackAction } from "@/app/meal-actions";
import { CookIngredientChecklist } from "@/components/cook-ingredient-checklist";
import { CookSteps } from "@/components/cook-steps";
import { AppShell } from "@/components/app-shell";
import { MealServingsForm } from "@/components/meal-servings-form";
import { MealVotePanel } from "@/components/meal-vote-panel";
import { RecipeChatBox } from "@/components/recipe-chat-box";
import { buildCookViewModel } from "@/lib/cook-view";
import { getDb } from "@/lib/db";
import { canManagePlans, requireFamilyContext } from "@/lib/family";
import { getUserLlmSettingsForDisplay } from "@/lib/llm-settings";

export const dynamic = "force-dynamic";

function NotebookSection({
  accent = "green",
  children,
  title,
}: {
  accent?: "green" | "tomato";
  children: ReactNode;
  title: string;
}) {
  const accentClass =
    accent === "tomato" ? "text-[var(--tomato)]" : "text-[var(--herb-dark)]";

  return (
    <section className="border-t border-[var(--line)] py-5 first:border-t-0 first:pt-0">
      <h2 className={`recipe-display text-xl font-semibold ${accentClass}`}>
        {title}
      </h2>
      <div className="mt-3 text-sm font-semibold leading-6 text-[var(--muted-ink)]">{children}</div>
    </section>
  );
}

export default async function CookPage({
  params,
}: {
  params: Promise<{ mealId: string }>;
}) {
  const { mealId } = await params;
  const context = await requireFamilyContext(`/cook/${mealId}`);
  const canManage = canManagePlans(context.role);
  const llmSettings = await getUserLlmSettingsForDisplay(context.user.id);
  const meal = await getDb().meal.findFirst({
    include: {
      dayPlan: {
        include: {
          week: {
            include: {
              days: {
                include: {
                  dinner: {
                    select: {
                      id: true,
                      name: true,
                    },
                  },
                },
                orderBy: {
                  date: "asc",
                },
              },
            },
          },
        },
      },
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
    where: {
      dayPlan: {
        week: {
          familyId: context.family.id,
        },
      },
      id: mealId,
    },
  });

  if (!meal) {
    notFound();
  }

  const view = buildCookViewModel({
    date: meal.dayPlan.date,
    meal,
    week: meal.dayPlan.week,
    weekDays: meal.dayPlan.week.days.map((day) => ({
      date: day.date,
      mealId: day.dinner?.id,
      mealName: day.dinner?.name,
    })),
  });
  const validationCount = view.validationFlags.filter((flag) => flag.active).length;

  return (
    <AppShell family={context.family} role={context.role} user={context.user}>
      <div className="cook-surface -m-[clamp(1.25rem,3vw,2.5rem)] min-h-[calc(100vh-3rem)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1500px] space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              className="ka-button-secondary gap-2"
              href={view.weekHref}
            >
              <ArrowLeft size={16} />
              Week
            </Link>
            <Link
              className="ka-button-secondary gap-2"
              href={`/weeks/${meal.dayPlan.week.id}/closeout`}
            >
              Closeout
              <ClipboardList size={16} />
            </Link>
            <div className="flex flex-wrap gap-2">
              {view.previousMeal ? (
                <Link
                  className="ka-button-secondary gap-2"
                  href={view.previousMeal.href}
                >
                  <ArrowLeft size={16} />
                  {view.previousMeal.dateLabel}
                </Link>
              ) : null}
              {view.nextMeal ? (
                <Link
                  className="ka-button gap-2"
                  href={view.nextMeal.href}
                >
                  {view.nextMeal.dateLabel}
                  <ArrowRight size={16} />
                </Link>
              ) : null}
            </div>
          </div>

          <article className="cook-article">
            <header className="grid gap-6 border-b border-[var(--line-strong)] p-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-7">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-sm font-black text-[var(--herb-dark)]">
                  <CalendarDays size={17} />
                  <span>{view.dateLabel}</span>
                  <span className="text-[var(--brass)]">/</span>
                  <span>{view.weekTitle ?? "Dinner plan"}</span>
                </div>
                <h1 className="recipe-display mt-4 max-w-5xl text-4xl font-semibold leading-tight text-[var(--ink)] md:text-6xl">
                  {view.title}
                </h1>
                {view.whyThisWorks ? (
                  <p className="mt-4 max-w-4xl text-base font-semibold leading-7 text-[var(--muted-ink)]">
                    {view.whyThisWorks}
                  </p>
                ) : null}
                <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-xs font-black uppercase tracking-[0.14em] text-[var(--muted-ink)]">
                  {view.tags.map((tag) => (
                    <span className="border-l-2 border-[var(--herb)] pl-2" key={tag}>
                      {tag}
                    </span>
                  ))}
                  {view.difficulty ? (
                    <span className="border-l-2 border-[var(--tomato)] pl-2 text-[var(--tomato)]">
                      {view.difficulty}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="grid gap-x-6 gap-y-5 border-t border-[var(--line)] pt-5 sm:grid-cols-2 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <div>
                  <UsersRound className="text-[var(--herb)]" size={20} />
                  <div className="mt-3 text-3xl font-black text-[var(--ink)]">
                    {view.servings}
                  </div>
                  <div className="text-sm font-semibold text-[var(--muted-ink)]">servings</div>
                  {canManage ? (
                    <MealServingsForm
                      className="mt-3"
                      mealId={meal.id}
                      servings={view.servings}
                    />
                  ) : null}
                </div>
                <div>
                  <Clock3 className="text-[var(--tomato)]" size={20} />
                  <div className="mt-3 text-3xl font-black text-[var(--ink)]">
                    {view.totalMinutes ?? "?"}
                  </div>
                  <div className="text-sm font-semibold text-[var(--muted-ink)]">
                    min total{view.activeMinutes ? ` / ${view.activeMinutes} active` : ""}
                  </div>
                </div>
                <div>
                  <DollarSign className="text-[var(--herb)]" size={20} />
                  <div className="mt-3 text-3xl font-black text-[var(--ink)]">
                    {view.costLabel}
                  </div>
                  <div className="text-sm font-semibold text-[var(--muted-ink)]">estimated cost</div>
                </div>
                <div>
                  <BadgeCheck className="text-[var(--tomato)]" size={20} />
                  <div className="mt-3 text-3xl font-black text-[var(--ink)]">
                    {validationCount}/6
                  </div>
                  <div className="text-sm font-semibold text-[var(--muted-ink)]">validation flags</div>
                </div>
              </div>
            </header>

            <div className="grid xl:grid-cols-[330px_minmax(0,1fr)_360px]">
              <aside className="p-5 xl:self-start xl:border-r xl:border-[var(--line)] xl:p-6">
                <CookIngredientChecklist ingredients={view.ingredients} />
              </aside>

              <main className="border-t border-[var(--line)] p-5 xl:border-r xl:border-t-0 xl:p-6">
                <CookSteps steps={view.steps} />
              </main>

              <aside className="border-t border-[var(--line)] p-5 xl:self-start xl:border-t-0 xl:p-6">
                {view.health.plateBuild ||
                view.health.changes.length ||
                view.health.whyItHelps.length ? (
                  <NotebookSection title="Cody Plate">
                    {view.health.plateBuild ? <p>{view.health.plateBuild}</p> : null}
                    {view.health.changes.length ? (
                      <ul className="mt-3 list-disc space-y-1 pl-5">
                        {view.health.changes.map((change) => (
                          <li key={change}>{change}</li>
                        ))}
                      </ul>
                    ) : null}
                    {view.health.whyItHelps.length ? (
                      <p className="mt-3 font-black text-[var(--herb-dark)]">
                        {view.health.whyItHelps.join(" ")}
                      </p>
                    ) : null}
                  </NotebookSection>
                ) : null}

                {view.kid.strategy || view.kid.notes.length ? (
                  <NotebookSection title="Kid Setup">
                    {view.kid.strategy ? <p>{view.kid.strategy}</p> : null}
                    {view.kid.serveComponentsSeparately ? (
                      <p className="mt-2 font-black text-[var(--herb-dark)]">
                        Components served separately
                      </p>
                    ) : null}
                    {view.kid.notes.length ? (
                      <ul className="mt-3 list-disc space-y-1 pl-5">
                        {view.kid.notes.map((note) => (
                          <li key={note}>{note}</li>
                        ))}
                      </ul>
                    ) : null}
                  </NotebookSection>
                ) : null}

                <NotebookSection title="Dinner Signals">
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {view.validationFlags.map((flag) => (
                      <span
                        className={`text-xs font-bold uppercase tracking-[0.12em] ${
                          flag.active ? "text-[var(--herb-dark)]" : "text-[var(--muted-ink)]"
                        }`}
                        key={flag.label}
                      >
                        {flag.label}
                      </span>
                    ))}
                  </div>
                </NotebookSection>

                <MealVotePanel
                  currentUserId={context.user.id}
                  mealId={meal.id}
                  votes={meal.votes}
                />

                <RecipeChatBox
                  enabled={Boolean(llmSettings)}
                  mealId={meal.id}
                  modelLabel={llmSettings?.modelId}
                />

                {canManage ? (
                <NotebookSection title="Feedback" accent="tomato">
                  <form action={recordFeedbackAction} className="space-y-4">
                    <input name="mealId" type="hidden" value={meal.id} />
                    <input name="weekId" type="hidden" value={meal.dayPlan.week.id} />
                    <p className="font-black text-[var(--muted-ink)]">
                      Current: {view.feedbackStatus}
                    </p>
                    <label className="block">
                      <span className="ka-label">
                        Status
                      </span>
                      <select
                        className="ka-select mt-1 bg-transparent px-0 text-sm font-semibold"
                        defaultValue={meal.feedbackStatus}
                        name="status"
                      >
                        <option value="LIKED">Liked</option>
                        <option value="WORKED_WITH_TWEAKS">Worked with tweaks</option>
                        <option value="REJECTED">Rejected</option>
                        <option value="PLANNED">Planned</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="ka-label">
                        Reason
                      </span>
                      <textarea
                        className="ka-textarea mt-1 min-h-20 bg-transparent px-0 py-2 text-sm leading-6"
                        defaultValue={meal.feedbackReason ?? ""}
                        name="reason"
                        placeholder="What worked or did not work?"
                      />
                    </label>
                    <label className="block">
                      <span className="ka-label">
                        Tweaks
                      </span>
                      <textarea
                        className="ka-textarea mt-1 min-h-20 bg-transparent px-0 py-2 text-sm leading-6"
                        defaultValue={meal.feedbackTweaks ?? ""}
                        name="tweaks"
                        placeholder="What should change next time?"
                      />
                    </label>
                    <details className="group">
                      <summary className="cursor-pointer text-sm font-black text-[var(--herb-dark)]">
                        Rejection pattern
                      </summary>
                      <div className="mt-3 space-y-3">
                        <label className="block">
                          <span className="ka-label">
                            Pattern to avoid
                          </span>
                          <input
                            className="ka-field mt-1 bg-transparent px-0 text-sm"
                            name="patternToAvoid"
                            placeholder="e.g. kale-heavy soups"
                          />
                        </label>
                        <label className="flex items-start gap-2 text-sm font-semibold text-[var(--muted-ink)]">
                          <input
                            className="mt-1 size-4 accent-[var(--tomato)]"
                            name="createRejectedPattern"
                            type="checkbox"
                          />
                          Add this to rejected meals when status is rejected.
                        </label>
                      </div>
                    </details>
                    <button className="ka-button w-full">
                      Save feedback
                    </button>
                  </form>
                </NotebookSection>
                ) : null}

                {view.nutrition.length ? (
                  <NotebookSection title="Nutrition">
                    <dl className="grid grid-cols-2 gap-x-5 gap-y-3">
                      {view.nutrition.slice(0, 8).map((entry) => (
                        <div key={entry.key}>
                          <dt className="text-xs font-black uppercase tracking-[0.14em] text-[var(--brass)]">
                            {entry.label}
                          </dt>
                          <dd className="mt-1 text-lg font-black text-[var(--ink)]">
                            {entry.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </NotebookSection>
                ) : null}

                {view.equipment.length ? (
                  <NotebookSection title="Equipment">
                    <ul className="space-y-2">
                      {view.equipment.map((item) => (
                        <li className="flex gap-2" key={item}>
                          <ChefHat className="mt-1 shrink-0 text-[var(--herb)]" size={15} />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </NotebookSection>
                ) : null}

                {view.batchPrepNote ||
                view.leftovers.storage ||
                view.leftovers.reuseIdeas.length ||
                view.servingNotes.length ? (
                  <NotebookSection title="Prep And Leftovers" accent="tomato">
                    {view.batchPrepNote ? <p>{view.batchPrepNote}</p> : null}
                    {view.leftovers.storage ? (
                      <p className="mt-3">{view.leftovers.storage}</p>
                    ) : null}
                    {view.leftovers.reuseIdeas.length ? (
                      <ul className="mt-3 list-disc space-y-1 pl-5">
                        {view.leftovers.reuseIdeas.map((idea) => (
                          <li key={idea}>{idea}</li>
                        ))}
                      </ul>
                    ) : null}
                    {view.servingNotes.length ? (
                      <div className="mt-3 border-t border-[var(--line)] pt-3">
                        {view.servingNotes.join(" ")}
                      </div>
                    ) : null}
                  </NotebookSection>
                ) : null}

                <section className="border-t border-[var(--line)] pt-5 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
                  <div className="flex gap-2">
                    <HeartPulse className="mt-1 shrink-0 text-[var(--herb)]" size={17} />
                    <span>Medical guidance is planning metadata, not clinical advice.</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Salad className="mt-1 shrink-0 text-[var(--herb)]" size={17} />
                    <span>Imported recipe details stay attached to this meal.</span>
                  </div>
                </section>
              </aside>
            </div>
          </article>
        </div>
      </div>
    </AppShell>
  );
}
