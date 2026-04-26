import type { ShoppingItemStatus } from "@prisma/client";

import { getDb } from "./db";
import { normalizeIngredientName } from "./ingredients";

export type ShoppingItemStatusPayload = {
  canonicalName?: string | null;
  itemName: string;
  quantity?: string | null;
  status: ShoppingItemStatus;
  weekId: string;
};

export type ShoppingItemStatusUpdateResult = {
  canonicalName: string;
  itemName: string;
  quantity: string | null;
  status: ShoppingItemStatus;
  updatedBy: {
    email: string;
    name: string | null;
  } | null;
};

export async function upsertShoppingItemStatusForFamily({
  familyId,
  payload,
  userId,
}: {
  familyId: string;
  payload: ShoppingItemStatusPayload;
  userId: string;
}): Promise<ShoppingItemStatusUpdateResult | null> {
  const canonicalName = normalizeIngredientName(
    payload.canonicalName || payload.itemName,
  );
  const quantity = payload.quantity?.trim() || null;
  const week = await getDb().week.findFirst({
    select: {
      id: true,
    },
    where: {
      familyId,
      id: payload.weekId,
    },
  });

  if (!week) {
    return null;
  }

  const state = await getDb().shoppingItemState.upsert({
    create: {
      canonicalName,
      familyId,
      itemName: payload.itemName,
      quantity,
      status: payload.status,
      updatedByUserId: userId,
      weekId: week.id,
    },
    include: {
      updatedBy: {
        select: {
          email: true,
          name: true,
        },
      },
    },
    update: {
      itemName: payload.itemName,
      quantity,
      status: payload.status,
      updatedByUserId: userId,
    },
    where: {
      weekId_canonicalName: {
        canonicalName,
        weekId: week.id,
      },
    },
  });

  return {
    canonicalName: state.canonicalName,
    itemName: state.itemName,
    quantity: state.quantity,
    status: state.status,
    updatedBy: state.updatedBy,
  };
}
