import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { GroceryRefreshForm } from "@/components/grocery-refresh-form";
import { PageIntro } from "@/components/page-intro";
import { Section } from "@/components/section";
import {
  addDays,
  formatDisplayDate,
  startOfMealPlanWeek,
  toDateOnly,
} from "@/lib/dates";
import { getDb } from "@/lib/db";
import {
  buildGrocerySectionsFromIngredients,
  countGroceryItems,
  readGrocerySections,
  reconcileGroceryList,
  type GroceryListSection,
  type GroceryQuantityChange,
  type GroceryReconciliationItem,
} from "@/lib/grocery-reconciliation";
import { aggregateIngredientsForWeek } from "@/lib/ingredients";
import { canManagePlans, requireFamilyContext } from "@/lib/family";

export const dynamic = "force-dynamic";

function weekLabel(week: { title: string | null; weekStart: Date }) {
  return week.title ?? `Week of ${toDateOnly(week.weekStart)}`;
}

function quantityText(quantity?: string) {
  return quantity || "as needed";
}

function GroceryChangeList({
  emptyText,
  items,
  title,
}: {
  emptyText: string;
  items: GroceryReconciliationItem[];
  title: string;
}) {
  return (
    <div className="border border-[var(--line)] bg-[rgba(255,253,245,0.42)] p-4">
      <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
        {title}
      </h3>
      {items.length ? (
        <ul className="mt-3 space-y-2 text-sm font-semibold text-[var(--ink)]">
          {items.map((item) => (
            <li key={item.canonicalName}>
              <span className="capitalize">{item.item}</span>
              <span className="text-[var(--muted-ink)]">
                {" "}
                / {quantityText(item.quantity)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm font-semibold text-[var(--muted-ink)]">
          {emptyText}
        </p>
      )}
    </div>
  );
}

function QuantityChangeList({ items }: { items: GroceryQuantityChange[] }) {
  return (
    <div className="border border-[var(--line)] bg-[rgba(255,253,245,0.42)] p-4">
      <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
        Quantity changed
      </h3>
      {items.length ? (
        <ul className="mt-3 space-y-3 text-sm font-semibold text-[var(--ink)]">
          {items.map((item) => (
            <li key={item.canonicalName}>
              <span className="capitalize">{item.item}</span>
              <div className="mt-1 text-xs leading-5 text-[var(--muted-ink)]">
                Stored {quantityText(item.previousQuantity)} / Current{" "}
                {quantityText(item.nextQuantity)}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm font-semibold text-[var(--muted-ink)]">
          No quantity differences.
        </p>
      )}
    </div>
  );
}

function GrocerySectionPreview({ sections }: { sections: GroceryListSection[] }) {
  if (!sections.length) {
    return (
      <p className="text-sm font-semibold text-[var(--muted-ink)]">
        No current meal ingredients to preview.
      </p>
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {sections.map((section) => (
        <div className="border border-[var(--line)] p-4" key={section.name}>
          <h3 className="recipe-display text-2xl font-semibold text-[var(--ink)]">
            {section.name}
          </h3>
          <ul className="mt-3 space-y-2 text-sm font-semibold text-[var(--ink)]">
            {section.items.map((item) => (
              <li key={`${section.name}-${item.item}`}>
                <span className="capitalize">{item.item}</span>
                <span className="text-[var(--muted-ink)]">
                  {" "}
                  / {quantityText(item.quantity)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default async function IngredientsPage({
  searchParams,
}: {
  searchParams: Promise<{ weekId?: string }>;
}) {
  const context = await requireFamilyContext("/ingredients");
  const params = await searchParams;
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
      groceryList: true,
    },
    orderBy: {
      weekStart: "desc",
    },
    where: {
      familyId: context.family.id,
    },
  });
  const currentWeekStart = startOfMealPlanWeek();
  const pantryStaples = await getDb().pantryStaple.findMany({
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
  });
  const selectedWeek =
    weeks.find((week) => week.id === params.weekId) ??
    weeks.find((week) => toDateOnly(week.weekStart) === toDateOnly(currentWeekStart)) ??
    weeks[0];
  const daySlots = selectedWeek
    ? Array.from({ length: 7 }, (_, index) => addDays(selectedWeek.weekStart, index))
    : [];
  const ingredients = selectedWeek
    ? aggregateIngredientsForWeek(
        selectedWeek.days
          .filter((day) => day.dinner)
          .map((day) => ({
            date: day.date,
            ingredients: day.dinner!.ingredients,
            mealName: day.dinner!.name,
          })),
      )
    : [];
  const derivedGrocerySections = buildGrocerySectionsFromIngredients(
    ingredients,
    pantryStaples,
  );
  const storedGrocerySections = selectedWeek?.groceryList
    ? readGrocerySections(selectedWeek.groceryList.sections)
    : null;
  const reconciliation = selectedWeek
    ? reconcileGroceryList({
        derivedSections: derivedGrocerySections,
        storedSections: storedGrocerySections,
      })
    : null;
  const derivedGroceryItemCount = countGroceryItems(derivedGrocerySections);
  const canRefreshGroceryList = canManagePlans(context.role);

  return (
    <AppShell family={context.family} role={context.role} user={context.user}>
      <div className="ka-page">
        <PageIntro
          actions={
            weeks.length > 0 ? (
            <form action="/ingredients" className="flex flex-col gap-2 sm:flex-row">
              <select
                    className="ka-select min-w-72"
                defaultValue={selectedWeek?.id}
                name="weekId"
              >
                {weeks.map((week) => (
                  <option key={week.id} value={week.id}>
                    {weekLabel(week)} · {toDateOnly(week.weekStart)}
                  </option>
                ))}
              </select>
                  <button className="ka-button">
                View week
              </button>
            </form>
            ) : null
          }
          eyebrow="Grocery rollup"
          title="Ingredients"
        >
          Normalized ingredient totals for the selected week, with daily ledger marks
          showing how much each recipe contributes.
        </PageIntro>

        {!selectedWeek ? (
          <Section title="No Meals Yet">
            <p className="text-sm leading-6 text-[var(--muted-ink)]">
              Import a weekly JSON plan or create meals through the API, then this
              page will roll every recipe&apos;s ingredients into a single view.
            </p>
          </Section>
        ) : (
          <>
            {reconciliation ? (
              <Section
                description="Compare the stored grocery list with the current planned dinners before shopping."
                title="Grocery Reconciliation"
              >
                <div className="ka-panel border border-[var(--line)]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div
                        className="ka-status-mark"
                        data-tone={reconciliation.hasChanges ? "warm" : "muted"}
                      >
                        {reconciliation.hasChanges
                          ? "Needs refresh"
                          : "Stored list matches"}
                      </div>
                      <p className="mt-3 max-w-3xl text-sm font-semibold leading-6 text-[var(--muted-ink)]">
                        Stored list: {reconciliation.storedItemCount} items / Current
                        plan: {reconciliation.derivedItemCount} items / Unchanged:{" "}
                        {reconciliation.unchangedCount}
                      </p>
                    </div>
                    {canRefreshGroceryList ? (
                      <GroceryRefreshForm
                        disabled={derivedGroceryItemCount === 0}
                        weekId={selectedWeek.id}
                      />
                    ) : (
                      <p className="max-w-sm text-sm font-semibold leading-6 text-[var(--muted-ink)]">
                        Owners and admins can refresh the stored grocery list.
                      </p>
                    )}
                  </div>

                  <div className="mt-5 grid gap-3 xl:grid-cols-3">
                    <GroceryChangeList
                      emptyText="No new items."
                      items={reconciliation.added}
                      title="Added"
                    />
                    <QuantityChangeList items={reconciliation.quantityChanged} />
                    <GroceryChangeList
                      emptyText="No removed items."
                      items={reconciliation.removed}
                      title="Removed"
                    />
                  </div>

                  <div className="mt-6 border-t border-[var(--line)] pt-5">
                    <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
                      Refresh preview
                    </h3>
                    <div className="mt-3">
                      <GrocerySectionPreview sections={derivedGrocerySections} />
                    </div>
                  </div>
                </div>
              </Section>
            ) : null}

            <Section
              description={`${ingredients.length} normalized ingredient groups from ${
                selectedWeek.days.filter((day) => day.dinner).length
              } planned dinners.`}
              title={weekLabel(selectedWeek)}
            >
              {ingredients.length === 0 ? (
                <p className="text-sm leading-6 text-[var(--muted-ink)]">
                  This week has no dinner ingredients yet.
                </p>
              ) : (
                <div className="ka-panel divide-y divide-[var(--line)]">
                  {ingredients.map((ingredient) => (
                    <div
                      className="ledger-row"
                      key={ingredient.canonicalName}
                    >
                      <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                        <div>
                          <h2 className="recipe-display text-2xl font-semibold capitalize text-[var(--ink)]">
                            {ingredient.canonicalName}
                          </h2>
                          {ingredient.pantryItem ? (
                            <span className="ka-status-mark mt-2" data-tone="muted">
                              pantry item
                            </span>
                          ) : null}
                        </div>
                        <div className="text-sm font-black uppercase tracking-[0.12em] text-[var(--herb-dark)]">
                          Total: {ingredient.displayTotal}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-7">
                        {daySlots.map((date) => {
                          const dayIngredient = ingredient.days.find(
                            (day) => toDateOnly(day.date) === toDateOnly(date),
                          );

                          return (
                            <div
                              className={`min-h-28 border-l-2 p-3 ${
                                dayIngredient
                                  ? "border-[var(--herb)] bg-[rgba(66,102,63,0.09)]"
                                  : "border-[var(--line)] bg-[rgba(255,253,245,0.38)]"
                              }`}
                              key={`${ingredient.canonicalName}-${toDateOnly(date)}`}
                            >
                              <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
                                {formatDisplayDate(date)}
                              </div>
                              {dayIngredient ? (
                                <>
                                  <div className="mt-2 text-base font-black text-[var(--ink)]">
                                    {dayIngredient.displayQuantity}
                                  </div>
                                  <div className="mt-2 line-clamp-2 text-xs font-semibold leading-5 text-[var(--muted-ink)]">
                                    {dayIngredient.mealName}
                                  </div>
                                </>
                              ) : (
                                <div className="mt-5 text-sm font-semibold text-[rgba(111,88,65,0.55)]">
                                  Not used
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <div className="flex flex-wrap justify-end gap-2">
              <Link
                className="ka-button-secondary"
                href={`/weeks/${selectedWeek.id}`}
              >
                Open week detail
              </Link>
              <Link
                className="ka-button-secondary"
                href={`/weeks/${selectedWeek.id}/shopping`}
              >
                Open shopping
              </Link>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}
