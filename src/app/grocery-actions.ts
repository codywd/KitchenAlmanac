"use server";

import { revalidatePath } from "next/cache";

import { assertCanManagePlans, requireFamilyContext } from "@/lib/family";
import {
  applySmartGroceryMergeForFamilyWeek,
  refreshGroceryListForFamilyWeek,
} from "@/lib/grocery-api";

export type GroceryRefreshActionState = {
  error?: string;
  message?: string;
  weekId?: string;
};

function formValues(formData: FormData, name: string) {
  return formData
    .getAll(name)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

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

export async function applySmartGroceryMergeAction(
  _previousState: GroceryRefreshActionState,
  formData: FormData,
): Promise<GroceryRefreshActionState> {
  const context = await requireFamilyContext("/ingredients");
  assertCanManagePlans(context.role);

  const weekId = String(formData.get("weekId") ?? "").trim();

  if (!weekId) {
    return { error: "Choose a week before applying smart grocery suggestions." };
  }

  try {
    const result = await applySmartGroceryMergeForFamilyWeek({
      acceptedCanonicalNames: formValues(formData, "addCanonicalName"),
      familyId: context.family.id,
      pantryCandidateCanonicalNames: formValues(
        formData,
        "pantryCandidateCanonicalName",
      ),
      weekId,
    });

    if (!result) {
      return { error: "Week not found." };
    }

    revalidatePath("/ingredients");
    revalidatePath(`/weeks/${result.weekId}`);
    revalidatePath(`/weeks/${result.weekId}/shopping`);
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
          : "Could not apply smart grocery suggestions.",
    };
  }
}
