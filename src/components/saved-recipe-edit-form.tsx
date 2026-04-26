"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";

import {
  updateSavedRecipeAction,
  type SavedRecipeActionState,
} from "@/app/recipe-actions";

const initialState: SavedRecipeActionState = {};

type SavedRecipeForEdit = {
  active: boolean;
  batchPrepNote: string | null;
  budgetFit: boolean;
  costEstimateCents: number | null;
  cuisine: string | null;
  diabetesFriendly: boolean;
  heartHealthy: boolean;
  id: string;
  ingredients: unknown;
  kidAdaptations: string | null;
  kidFriendly: boolean;
  methodSteps: string[];
  name: string;
  noFishSafe: boolean;
  prepTimeActiveMinutes: number | null;
  prepTimeTotalMinutes: number | null;
  servings: number;
  validationNotes: string | null;
  weeknightTimeSafe: boolean;
};

function centsToDollars(value: number | null) {
  return typeof value === "number" ? (value / 100).toFixed(2) : "";
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="block">
      <span className="ka-label">{label}</span>
      {children}
    </label>
  );
}

function Flag({
  defaultChecked,
  label,
  name,
}: {
  defaultChecked: boolean;
  label: string;
  name: string;
}) {
  return (
    <label className="flex min-h-10 items-center gap-2 border border-[var(--line)] bg-[rgba(255,253,245,0.42)] px-3 text-sm font-black text-[var(--ink)]">
      <input
        className="size-4 accent-[var(--herb)]"
        defaultChecked={defaultChecked}
        name={name}
        type="checkbox"
      />
      {label}
    </label>
  );
}

export function SavedRecipeEditForm({ recipe }: { recipe: SavedRecipeForEdit }) {
  const [state, action, pending] = useActionState(
    updateSavedRecipeAction,
    initialState,
  );

  return (
    <form action={action} className="space-y-4">
      <input name="recipeId" type="hidden" value={recipe.id} />
      <input name="active" type="hidden" value={recipe.active ? "on" : ""} />
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Recipe name">
          <input
            className="ka-field mt-1"
            defaultValue={recipe.name}
            name="name"
            required
          />
        </Field>
        <Field label="Cuisine">
          <input
            className="ka-field mt-1"
            defaultValue={recipe.cuisine ?? ""}
            name="cuisine"
          />
        </Field>
        <Field label="Cost estimate dollars">
          <input
            className="ka-field mt-1"
            defaultValue={centsToDollars(recipe.costEstimateCents)}
            inputMode="decimal"
            name="costEstimateDollars"
          />
        </Field>
        <Field label="Servings">
          <input
            className="ka-field mt-1"
            defaultValue={recipe.servings}
            min={1}
            name="servings"
            required
            type="number"
          />
        </Field>
        <Field label="Active prep minutes">
          <input
            className="ka-field mt-1"
            defaultValue={recipe.prepTimeActiveMinutes ?? ""}
            min={0}
            name="prepTimeActiveMinutes"
            type="number"
          />
        </Field>
        <Field label="Total minutes">
          <input
            className="ka-field mt-1"
            defaultValue={recipe.prepTimeTotalMinutes ?? ""}
            min={0}
            name="prepTimeTotalMinutes"
            type="number"
          />
        </Field>
      </div>

      <Field label="Ingredients JSON">
        <textarea
          className="ka-textarea mt-1 min-h-48 font-mono text-xs leading-5"
          defaultValue={JSON.stringify(recipe.ingredients, null, 2)}
          name="ingredientsJson"
          required
          spellCheck={false}
        />
      </Field>
      <Field label="Method steps">
        <textarea
          className="ka-textarea mt-1 min-h-36 text-sm"
          defaultValue={recipe.methodSteps.join("\n")}
          name="methodStepsText"
          placeholder="One step per line"
        />
      </Field>

      <div className="grid gap-2 md:grid-cols-3">
        <Flag
          defaultChecked={recipe.diabetesFriendly}
          label="Diabetes"
          name="diabetesFriendly"
        />
        <Flag
          defaultChecked={recipe.heartHealthy}
          label="Heart"
          name="heartHealthy"
        />
        <Flag defaultChecked={recipe.noFishSafe} label="No fish" name="noFishSafe" />
        <Flag defaultChecked={recipe.kidFriendly} label="Kid" name="kidFriendly" />
        <Flag defaultChecked={recipe.budgetFit} label="Budget" name="budgetFit" />
        <Flag
          defaultChecked={recipe.weeknightTimeSafe}
          label="Weeknight"
          name="weeknightTimeSafe"
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Kid adaptations">
          <textarea
            className="ka-textarea mt-1 min-h-28 text-sm"
            defaultValue={recipe.kidAdaptations ?? ""}
            name="kidAdaptations"
          />
        </Field>
        <Field label="Batch prep">
          <textarea
            className="ka-textarea mt-1 min-h-28 text-sm"
            defaultValue={recipe.batchPrepNote ?? ""}
            name="batchPrepNote"
          />
        </Field>
        <Field label="Validation notes">
          <textarea
            className="ka-textarea mt-1 min-h-28 text-sm"
            defaultValue={recipe.validationNotes ?? ""}
            name="validationNotes"
          />
        </Field>
      </div>

      <button className="ka-button gap-2 disabled:opacity-60" disabled={pending}>
        <Save size={16} />
        Save recipe
      </button>
      {state.error ? <div className="ka-error text-sm">{state.error}</div> : null}
      {state.message ? (
        <div className="ka-success text-sm">{state.message}</div>
      ) : null}
    </form>
  );
}
