import { createRejectedMealAction, toggleRejectedMealAction } from "@/app/meal-actions";
import { AppShell } from "@/components/app-shell";
import { PageIntro } from "@/components/page-intro";
import { Section } from "@/components/section";
import { getDb } from "@/lib/db";
import { canManagePlans, requireFamilyContext } from "@/lib/family";

export const dynamic = "force-dynamic";

export default async function RejectedMealsPage() {
  const context = await requireFamilyContext("/rejected-meals");
  const canManage = canManagePlans(context.role);
  const rejectedMeals = await getDb().rejectedMeal.findMany({
    orderBy: {
      rejectedAt: "desc",
    },
    where: {
      familyId: context.family.id,
    },
  });

  return (
    <AppShell family={context.family} role={context.role} user={context.user}>
      <div className="ka-page">
      <PageIntro eyebrow="Feedback memory" title="Rejected meals">
          Store both the exact meal and the reusable pattern to avoid so the outside
          LLM can steer future plans away from known failures.
      </PageIntro>

      {canManage ? (
      <Section title="Add Rejection">
        <form action={createRejectedMealAction} className="grid gap-3 lg:grid-cols-3">
          <input
            className="ka-field"
            name="mealName"
            placeholder="Meal name"
            required
          />
          <input
            className="ka-field"
            name="reason"
            placeholder="Why it failed"
            required
          />
          <input
            className="ka-field"
            name="patternToAvoid"
            placeholder="Pattern to avoid"
            required
          />
          <button className="ka-button lg:col-start-3">
            Add rejected meal
          </button>
        </form>
      </Section>
      ) : null}

      <Section title="Stored Patterns">
        <div className="ka-panel divide-y divide-[var(--line)]">
          {rejectedMeals.map((meal) => (
            <div
              className="py-4 first:pt-0 last:pb-0"
              key={meal.id}
            >
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-[var(--ink)]">{meal.mealName}</h2>
                    <span
                      className={`ka-status-mark ${
                        meal.active
                          ? ""
                          : "bg-[rgba(111,88,65,0.12)] text-[var(--muted-ink)]"
                      }`}
                    >
                      {meal.active ? "active" : "inactive"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted-ink)]">{meal.reason}</p>
                  <p className="mt-2 text-sm font-black text-[var(--tomato-dark)]">
                    Avoid: {meal.patternToAvoid}
                  </p>
                </div>
                {canManage ? (
                <form action={toggleRejectedMealAction}>
                  <input name="id" type="hidden" value={meal.id} />
                  <input name="active" type="hidden" value={String(!meal.active)} />
                  <button className="ka-button-secondary">
                    {meal.active ? "Deactivate" : "Reactivate"}
                  </button>
                </form>
                ) : null}
              </div>
            </div>
          ))}
          {rejectedMeals.length === 0 ? (
            <p className="text-sm text-[var(--muted-ink)]">No rejected meals yet.</p>
          ) : null}
        </div>
      </Section>
      </div>
    </AppShell>
  );
}
