"use client";

import { RefreshCw } from "lucide-react";
import { useActionState } from "react";

import {
  refreshGroceryListFromCurrentMealsAction,
  type GroceryRefreshActionState,
} from "@/app/grocery-actions";

const initialState: GroceryRefreshActionState = {};

export function GroceryRefreshForm({
  disabled,
  weekId,
}: {
  disabled: boolean;
  weekId: string;
}) {
  const [state, action, pending] = useActionState(
    refreshGroceryListFromCurrentMealsAction,
    initialState,
  );

  return (
    <div>
      <form action={action}>
        <input name="weekId" type="hidden" value={weekId} />
        <button
          className="ka-button gap-2 disabled:opacity-60"
          disabled={disabled || pending}
        >
          <RefreshCw size={16} />
          Refresh stored grocery list
        </button>
      </form>
      {state.error ? <div className="ka-error mt-3 text-sm">{state.error}</div> : null}
      {state.message ? (
        <div className="ka-success mt-3 text-sm">{state.message}</div>
      ) : null}
    </div>
  );
}
