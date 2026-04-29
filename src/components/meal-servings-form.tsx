"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";

import {
  updateMealServingsAction,
  type MealServingsActionState,
} from "@/app/meal-actions";
import { MAX_MEAL_SERVINGS, MIN_MEAL_SERVINGS } from "@/lib/meal-servings";

const initialState: MealServingsActionState = {};

export function MealServingsForm({
  className = "",
  mealId,
  servings,
}: {
  className?: string;
  mealId: string;
  servings: number;
}) {
  const [state, action, pending] = useActionState(
    updateMealServingsAction,
    initialState,
  );

  return (
    <form action={action} className={className}>
      <input name="mealId" type="hidden" value={mealId} />
      <label className="block">
        <span className="ka-label">Servings</span>
        <div className="mt-1 flex flex-wrap gap-2">
          <input
            className="ka-field min-w-24 flex-1 text-sm font-black"
            defaultValue={servings}
            max={MAX_MEAL_SERVINGS}
            min={MIN_MEAL_SERVINGS}
            name="servings"
            required
            step={1}
            type="number"
          />
          <button
            className="ka-button-secondary gap-2 disabled:opacity-60"
            disabled={pending}
          >
            <Save size={15} />
            Save
          </button>
        </div>
      </label>
      {state.error ? <div className="ka-error mt-2 text-sm">{state.error}</div> : null}
      {state.message ? (
        <div className="ka-success mt-2 text-sm">{state.message}</div>
      ) : null}
    </form>
  );
}
