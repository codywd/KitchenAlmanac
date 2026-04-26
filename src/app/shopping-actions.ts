"use server";

import { getDb } from "@/lib/db";
import { assertCanManagePlans, requireFamilyContext } from "@/lib/family";
import { normalizeIngredientName } from "@/lib/ingredients";
import {
  pantryStapleCreateSchema,
  pantryStapleDeactivateSchema,
  shoppingItemStatusUpdateSchema,
} from "@/lib/schemas";
import { revalidateShoppingSurfaces } from "@/lib/shopping-revalidation";
import { upsertShoppingItemStatusForFamily } from "@/lib/shopping-status";

export type PantryStapleActionState = {
  error?: string;
  message?: string;
};

export async function setShoppingItemStatusAction(formData: FormData) {
  const context = await requireFamilyContext();
  const parsed = shoppingItemStatusUpdateSchema.safeParse({
    canonicalName: formData.get("canonicalName") || undefined,
    itemName: formData.get("itemName"),
    quantity: formData.get("quantity") || undefined,
    status: formData.get("status"),
    weekId: formData.get("weekId"),
  });

  if (!parsed.success) {
    return { error: "Choose a valid shopping status." };
  }

  const payload = parsed.data;

  try {
    const state = await upsertShoppingItemStatusForFamily({
      familyId: context.family.id,
      payload,
      userId: context.user.id,
    });

    if (!state) {
      return { error: "Week not found." };
    }

    revalidateShoppingSurfaces(payload.weekId);

    return {
      message: `Updated ${payload.itemName}.`,
      weekId: payload.weekId,
    };
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Could not update shopping item.",
    };
  }
}

export async function setShoppingItemStatusFormAction(formData: FormData) {
  await setShoppingItemStatusAction(formData);
}

export async function addPantryStapleAction(
  _previousState: PantryStapleActionState,
  formData: FormData,
): Promise<PantryStapleActionState> {
  const context = await requireFamilyContext("/weeks");
  assertCanManagePlans(context.role);
  const parsed = pantryStapleCreateSchema.safeParse({
    displayName: formData.get("displayName"),
  });

  if (!parsed.success) {
    return { error: "Name the pantry staple before adding it." };
  }

  const displayName = parsed.data.displayName;
  const canonicalName = normalizeIngredientName(displayName);

  try {
    await getDb().pantryStaple.upsert({
      create: {
        active: true,
        canonicalName,
        createdByUserId: context.user.id,
        displayName,
        familyId: context.family.id,
      },
      update: {
        active: true,
        createdByUserId: context.user.id,
        displayName,
      },
      where: {
        familyId_canonicalName: {
          canonicalName,
          familyId: context.family.id,
        },
      },
    });

    revalidateShoppingSurfaces();

    return { message: `Added ${displayName} to pantry staples.` };
  } catch (error) {
    return {
      error:
        error instanceof Error ? error.message : "Could not add pantry staple.",
    };
  }
}

export async function deactivatePantryStapleAction(formData: FormData) {
  const context = await requireFamilyContext("/weeks");
  assertCanManagePlans(context.role);
  const payload = pantryStapleDeactivateSchema.parse({
    stapleId: formData.get("stapleId"),
  });

  await getDb().pantryStaple.updateMany({
    data: {
      active: false,
      deactivatedByUserId: context.user.id,
    },
    where: {
      familyId: context.family.id,
      id: payload.stapleId,
    },
  });

  revalidateShoppingSurfaces();
}
