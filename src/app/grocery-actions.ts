"use server";

import { revalidatePath } from "next/cache";

import { assertCanManagePlans, requireFamilyContext } from "@/lib/family";
import { refreshGroceryListForFamilyWeek } from "@/lib/grocery-api";

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
    const result = await refreshGroceryListForFamilyWeek({
      familyId: context.family.id,
      weekId,
    });

    if (!result) {
      return { error: "Week not found." };
    }

    revalidatePath("/ingredients");
    revalidatePath(`/weeks/${result.weekId}`);
    revalidatePath(`/weeks/${result.weekId}/review`);

    return {
      message: result.message,
      weekId: result.weekId,
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
