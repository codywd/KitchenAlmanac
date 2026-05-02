"use client";

import { RefreshCw } from "lucide-react";
import { useActionState, useState } from "react";

import {
  replaceDinnerFromRecipeAction,
  type ReplaceDinnerActionState,
} from "@/app/meal-actions";

const initialState: ReplaceDinnerActionState = {};

const sampleRecipe = `{
  "dinner_title": "Lemon Chicken Rice Bowls",
  "estimated_cost_usd": 24,
  "ingredients": [
    { "name": "chicken breast", "amount": 2, "unit": "lb" }
  ],
  "instructions": [
    { "step": 1, "text": "Cook dinner." }
  ],
  "time": { "prep_minutes": 20, "total_minutes": 40 },
  "tags": ["kid-friendly"]
}`;

export function MealSwapForm({
  date,
  defaultOpen = false,
  detailsId,
  weekId,
}: {
  date: string;
  defaultOpen?: boolean;
  detailsId?: string;
  weekId: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [state, action, pending] = useActionState(
    replaceDinnerFromRecipeAction,
    initialState,
  );

  return (
    <details
      className="border-t border-[var(--line)] pt-4"
      id={detailsId}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      open={open}
    >
      <summary className="cursor-pointer text-sm font-black text-[var(--herb-dark)]">
        Swap dinner
      </summary>
      <form action={action} className="mt-4 space-y-3">
        <input name="date" type="hidden" value={date} />
        <input name="weekId" type="hidden" value={weekId} />
        <label className="block">
          <span className="ka-label">Single recipe JSON</span>
          <textarea
            className="ka-textarea mt-1 min-h-64 font-mono text-xs leading-5"
            name="recipeJson"
            placeholder={sampleRecipe}
            required
            spellCheck={false}
          />
        </label>
        <button className="ka-button-secondary gap-2 disabled:opacity-60" disabled={pending}>
          <RefreshCw size={15} />
          Replace dinner
        </button>
      </form>
      {state.error ? (
        <div className="ka-error mt-3 text-sm">{state.error}</div>
      ) : null}
      {state.message ? (
        <div className="ka-success mt-3 text-sm">{state.message}</div>
      ) : null}
    </details>
  );
}
