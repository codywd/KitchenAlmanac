"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { getDb } from "@/lib/db";
import { assertCanManagePlans, requireFamilyContext } from "@/lib/family";
import {
  buildGrocerySectionsFromIngredients,
  countGroceryItems,
  refreshedGroceryListNotes,
} from "@/lib/grocery-reconciliation";
import { aggregateIngredientsForWeek } from "@/lib/ingredients";

export type GroceryRefreshActionState = {
  error?: string;
  message?: string;
  weekId?: string;
};

export async function refreshGroceryListFromCurrentMealsAction(
  _previousState: GroceryRefreshActionState,
  formData: FormData,
): Promise<GroceryRefreshActionState> {
  const context = await requireFamilyContext("/ingredients");
  assertCanManagePlans(context.role);

  const weekId = String(formData.get("weekId") ?? "").trim();

  if (!weekId) {
    return { error: "Choose a week before refreshing the grocery list." };
  }

  try {
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
      },
      where: {
        familyId: context.family.id,
        id: weekId,
      },
    });

    if (!week) {
      return { error: "Week not found." };
    }

    const pantryStaples = await getDb().pantryStaple.findMany({
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
    const ingredients = aggregateIngredientsForWeek(
      week.days
        .filter((day) => day.dinner)
        .map((day) => ({
          date: day.date,
          ingredients: day.dinner!.ingredients,
          mealName: day.dinner!.name,
        })),
    );
    const sections = buildGrocerySectionsFromIngredients(
      ingredients,
      pantryStaples,
    );
    const itemCount = countGroceryItems(sections);

    if (itemCount === 0) {
      return { error: "This week has no meal ingredients to refresh from." };
    }

    await getDb().groceryList.upsert({
      create: {
        notes: refreshedGroceryListNotes,
        sections: sections as unknown as Prisma.InputJsonValue,
        weekId: week.id,
      },
      update: {
        notes: refreshedGroceryListNotes,
        sections: sections as unknown as Prisma.InputJsonValue,
      },
      where: {
        weekId: week.id,
      },
    });

    revalidatePath("/ingredients");
    revalidatePath(`/weeks/${week.id}`);
    revalidatePath(`/weeks/${week.id}/review`);

    return {
      message: `Refreshed grocery list from ${itemCount} current ingredient${
        itemCount === 1 ? "" : "s"
      }.`,
      weekId: week.id,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not refresh the grocery list.",
    };
  }
}
