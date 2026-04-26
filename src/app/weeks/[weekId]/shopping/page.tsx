import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Home,
  ListChecks,
  PackageCheck,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  deactivatePantryStapleAction,
  setShoppingItemStatusFormAction,
} from "@/app/shopping-actions";
import { AppShell } from "@/components/app-shell";
import { OfflineShoppingChecklist } from "@/components/offline-shopping-checklist";
import { OnlineOnlySubmitButton } from "@/components/online-only-submit-button";
import { PageIntro } from "@/components/page-intro";
import { PantryStapleForm } from "@/components/pantry-staple-form";
import { Section } from "@/components/section";
import { toDateOnly } from "@/lib/dates";
import { getDb } from "@/lib/db";
import {
  buildGrocerySectionsFromIngredients,
  readGrocerySections,
} from "@/lib/grocery-reconciliation";
import { canManagePlans, requireFamilyContext } from "@/lib/family";
import { aggregateIngredientsForWeek } from "@/lib/ingredients";
import { buildShoppingItems, groupShoppingItems, type ShoppingItem } from "@/lib/shopping";

export const dynamic = "force-dynamic";

const statusLabels = {
  ALREADY_HAVE: "Already have",
  BOUGHT: "Bought",
  NEEDED: "Need",
};

const statusIcons = {
  ALREADY_HAVE: Home,
  BOUGHT: CheckCircle2,
  NEEDED: Circle,
};

function personLabel(person: { email: string; name: string | null } | null) {
  return person?.name?.trim() || person?.email || "Not updated yet";
}

function ShoppingStatusButton({
  item,
  status,
  weekId,
}: {
  item: ShoppingItem;
  status: keyof typeof statusLabels;
  weekId: string;
}) {
  const Icon = statusIcons[status];
  const active = item.status === status;

  return (
    <form action={setShoppingItemStatusFormAction}>
      <input name="weekId" type="hidden" value={weekId} />
      <input name="canonicalName" type="hidden" value={item.canonicalName} />
      <input name="itemName" type="hidden" value={item.itemName} />
      <input name="quantity" type="hidden" value={item.quantity ?? ""} />
      <input name="status" type="hidden" value={status} />
      <button
        className={`min-h-10 border px-3 text-xs font-black uppercase tracking-[0.1em] transition ${
          active
            ? "border-[var(--herb)] bg-[rgba(66,102,63,0.14)] text-[var(--herb-dark)]"
            : "border-[var(--line)] bg-[rgba(255,253,245,0.56)] text-[var(--muted-ink)] hover:border-[var(--line-strong)]"
        }`}
      >
        <Icon size={14} />
        {statusLabels[status]}
      </button>
    </form>
  );
}

function ShoppingItemCard({ item, weekId }: { item: ShoppingItem; weekId: string }) {
  return (
    <div className="border border-[var(--line)] bg-[rgba(255,253,245,0.48)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-black capitalize text-[var(--ink)]">
            {item.itemName}
          </h3>
          <p className="mt-1 text-sm font-semibold text-[var(--muted-ink)]">
            {[item.quantity, item.sectionName].filter(Boolean).join(" / ")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {item.pantryItem ? (
              <span className="ka-status-mark" data-tone="muted">
                pantry
              </span>
            ) : null}
            {item.defaultedFromPantry ? (
              <span className="ka-status-mark" data-tone="warm">
                pantry default
              </span>
            ) : null}
          </div>
        </div>
        <div className="text-xs font-semibold leading-5 text-[var(--muted-ink)] sm:text-right">
          Updated by {personLabel(item.updatedBy)}
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {(["NEEDED", "BOUGHT", "ALREADY_HAVE"] as const).map((status) => (
          <ShoppingStatusButton
            item={item}
            key={`${item.canonicalName}-${status}`}
            status={status}
            weekId={weekId}
          />
        ))}
      </div>
    </div>
  );
}

function ShoppingGroup({
  emptyText,
  items,
  title,
  weekId,
}: {
  emptyText: string;
  items: ShoppingItem[];
  title: string;
  weekId: string;
}) {
  return (
    <Section
      description={`${items.length} item${items.length === 1 ? "" : "s"}.`}
      title={title}
    >
      {items.length ? (
        <div className="grid gap-3">
          {items.map((item) => (
            <ShoppingItemCard
              item={item}
              key={item.canonicalName}
              weekId={weekId}
            />
          ))}
        </div>
      ) : (
        <p className="text-sm font-semibold leading-6 text-[var(--muted-ink)]">
          {emptyText}
        </p>
      )}
    </Section>
  );
}

export default async function ShoppingPage({
  params,
}: {
  params: Promise<{ weekId: string }>;
}) {
  const { weekId } = await params;
  const context = await requireFamilyContext(`/weeks/${weekId}/shopping`);
  const canManage = canManagePlans(context.role);
  const week = await getDb().week.findFirst({
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
    where: {
      familyId: context.family.id,
      id: weekId,
    },
  });

  if (!week) {
    notFound();
  }

  const pantryStaples = await getDb().pantryStaple.findMany({
    orderBy: {
      displayName: "asc",
    },
    where: {
      active: true,
      familyId: context.family.id,
    },
  });
  const ingredients = aggregateIngredientsForWeek(
    week.days
      .filter((day) => day.dinner)
      .map((day) => ({
        date: day.date,
        ingredients: day.dinner!.ingredients,
        mealName: day.dinner!.name,
      })),
  );
  const derivedSections = buildGrocerySectionsFromIngredients(
    ingredients,
    pantryStaples,
  );
  const storedSections = week.groceryList
    ? readGrocerySections(week.groceryList.sections)
    : null;
  const items = buildShoppingItems({
    derivedSections,
    itemStates: week.shoppingItemStates.map((state) => ({
      canonicalName: state.canonicalName,
      itemName: state.itemName,
      quantity: state.quantity,
      status: state.status,
      updatedBy: state.updatedBy,
    })),
    pantryStaples,
    storedSections,
  });
  const groups = groupShoppingItems(items);

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
              <Link
                className="ka-button-secondary gap-2"
                href={`/ingredients?weekId=${week.id}`}
              >
                Ingredients
                <ListChecks size={16} />
              </Link>
            </div>
          }
          eyebrow="Shared shopping"
          title={week.title ?? `Week of ${toDateOnly(week.weekStart)}`}
        >
          A family checklist for the grocery list. Anyone in the family can mark
          items bought or already on hand.
        </PageIntro>

        <OfflineShoppingChecklist
          currentUser={{
            email: context.user.email,
            name: context.user.name,
          }}
          initialItems={items}
          weekId={week.id}
        />

        <noscript>
          <div className="grid gap-3 md:grid-cols-3">
            <div className="ka-panel border border-[var(--line)]">
              <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
                Need
              </div>
              <div className="mt-2 text-3xl font-black text-[var(--ink)]">
                {groups.NEEDED.length}
              </div>
            </div>
            <div className="ka-panel border border-[var(--line)]">
              <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
                Bought
              </div>
              <div className="mt-2 text-3xl font-black text-[var(--ink)]">
                {groups.BOUGHT.length}
              </div>
            </div>
            <div className="ka-panel border border-[var(--line)]">
              <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
                Already have
              </div>
              <div className="mt-2 text-3xl font-black text-[var(--ink)]">
                {groups.ALREADY_HAVE.length}
              </div>
            </div>
          </div>

          {items.length ? (
            <>
              <ShoppingGroup
                emptyText="Nothing left to buy."
                items={groups.NEEDED}
                title="Need"
                weekId={week.id}
              />
              <ShoppingGroup
                emptyText="No bought items yet."
                items={groups.BOUGHT}
                title="Bought"
                weekId={week.id}
              />
              <ShoppingGroup
                emptyText="No pantry items marked for this week."
                items={groups.ALREADY_HAVE}
                title="Already Have"
                weekId={week.id}
              />
            </>
          ) : (
            <Section title="No Grocery Items">
              <p className="text-sm font-semibold leading-6 text-[var(--muted-ink)]">
                Refresh the grocery list from ingredients or import a weekly plan,
                then this page becomes the shared shopping checklist.
              </p>
            </Section>
          )}
        </noscript>

        <Section
          description="Family-level defaults for items the household usually keeps on hand."
          title="Pantry Staples"
        >
          {canManage ? <PantryStapleForm /> : null}
          {pantryStaples.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {pantryStaples.map((staple) => (
                <div
                  className="ka-panel flex items-center justify-between gap-3 border border-[var(--line)]"
                  key={staple.id}
                >
                  <div>
                    <h3 className="text-base font-black text-[var(--ink)]">
                      {staple.displayName}
                    </h3>
                    <p className="mt-1 text-xs font-semibold text-[var(--muted-ink)]">
                      {staple.canonicalName}
                    </p>
                  </div>
                  {canManage ? (
                    <form action={deactivatePantryStapleAction}>
                      <input name="stapleId" type="hidden" value={staple.id} />
                      <OnlineOnlySubmitButton className="ka-button-secondary gap-2 disabled:opacity-60">
                        <PackageCheck size={15} />
                        Remove
                      </OnlineOnlySubmitButton>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
              No pantry staples are saved yet.
            </p>
          )}
        </Section>
      </div>
    </AppShell>
  );
}
