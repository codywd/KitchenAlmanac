"use client";

import { BookOpen } from "lucide-react";
import { useActionState } from "react";

import {
  replaceDinnerFromSavedRecipeAction,
  type SavedRecipeSwapActionState,
} from "@/app/recipe-actions";
import { formatMoney } from "@/lib/dates";

const initialState: SavedRecipeSwapActionState = {};

type SavedRecipeOption = {
  costEstimateCents: number | null;
  cuisine: string | null;
  id: string;
  name: string;
  prepTimeTotalMinutes: number | null;
};

export function SavedRecipeSwapForm({
  date,
  recipes,
  weekId,
}: {
  date: string;
  recipes: SavedRecipeOption[];
  weekId: string;
}) {
  const [state, action, pending] = useActionState(
    replaceDinnerFromSavedRecipeAction,
    initialState,
  );

  return (
    <details className="border-t border-[var(--line)] pt-4">
      <summary className="cursor-pointer text-sm font-black text-[var(--herb-dark)]">
        Swap from cookbook
      </summary>
      {recipes.length ? (
        <form action={action} className="mt-4 space-y-3">
          <input name="date" type="hidden" value={date} />
          <input name="weekId" type="hidden" value={weekId} />
          <label className="block">
            <span className="ka-label">Saved recipe</span>
            <select className="ka-field mt-1" name="recipeId" required>
              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.name}
                  {recipe.cuisine ? ` / ${recipe.cuisine}` : ""}
                  {typeof recipe.prepTimeTotalMinutes === "number"
                    ? ` / ${recipe.prepTimeTotalMinutes} min`
                    : ""}
                  {` / ${formatMoney(recipe.costEstimateCents)}`}
                </option>
              ))}
            </select>
          </label>
          <button
            className="ka-button-secondary gap-2 disabled:opacity-60"
            disabled={pending}
          >
            <BookOpen size={15} />
            Replace from cookbook
          </button>
        </form>
      ) : (
        <p className="mt-3 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
          Save a recipe from meal memory or closeout before swapping from the
          cookbook.
        </p>
      )}
      {state.error ? (
        <div className="ka-error mt-3 text-sm">{state.error}</div>
      ) : null}
      {state.message ? (
        <div className="ka-success mt-3 text-sm">{state.message}</div>
      ) : null}
    </details>
  );
}
