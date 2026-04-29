"use client";

import { Plus, Save, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";

import {
  createSavedRecipeAction,
  updateSavedRecipeAction,
  type SavedRecipeActionState,
} from "@/app/recipe-actions";

const initialState: SavedRecipeActionState = {};

type IngredientRow = {
  id: string;
  item: string;
  quantity: string;
};

type SavedRecipeForForm = {
  active: boolean;
  batchPrepNote: string | null;
  budgetFit: boolean;
  costEstimateCents: number | null;
  cuisine: string | null;
  diabetesFriendly: boolean;
  heartHealthy: boolean;
  id?: string;
  ingredients: unknown;
  kidAdaptations: string | null;
  kidFriendly: boolean;
  methodSteps: string[];
  name: string;
  noFishSafe: boolean;
  prepTimeActiveMinutes: number | null;
  prepTimeTotalMinutes: number | null;
  servings: number;
  sourceUrl: string | null;
  tags: string[];
  validationNotes: string | null;
  weeknightTimeSafe: boolean;
};

const emptyRecipe: SavedRecipeForForm = {
  active: true,
  batchPrepNote: null,
  budgetFit: false,
  costEstimateCents: null,
  cuisine: null,
  diabetesFriendly: false,
  heartHealthy: false,
  ingredients: [],
  kidAdaptations: null,
  kidFriendly: false,
  methodSteps: [],
  name: "",
  noFishSafe: true,
  prepTimeActiveMinutes: null,
  prepTimeTotalMinutes: null,
  servings: 7,
  sourceUrl: null,
  tags: [],
  validationNotes: null,
  weeknightTimeSafe: false,
};

function centsToDollars(value: number | null) {
  return typeof value === "number" ? (value / 100).toFixed(2) : "";
}

function ingredientRows(value: unknown): IngredientRow[] {
  if (!Array.isArray(value)) {
    return [{ id: "ingredient-0", item: "", quantity: "" }];
  }

  const rows = value
    .map((ingredient, index) => {
      if (!ingredient || typeof ingredient !== "object") {
        return null;
      }

      const record = ingredient as {
        item?: unknown;
        name?: unknown;
        quantity?: unknown;
      };
      const item =
        typeof record.item === "string"
          ? record.item
          : typeof record.name === "string"
            ? record.name
            : "";

      if (!item.trim()) {
        return null;
      }

      return {
        id: `ingredient-${index}`,
        item,
        quantity: typeof record.quantity === "string" ? record.quantity : "",
      };
    })
    .filter((row): row is IngredientRow => Boolean(row));

  return rows.length ? rows : [{ id: "ingredient-0", item: "", quantity: "" }];
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

function IngredientRows({ recipe }: { recipe: SavedRecipeForForm }) {
  const [rows, setRows] = useState(() => ingredientRows(recipe.ingredients));

  function updateRow(id: string, key: "item" | "quantity", value: string) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [key]: value } : row)),
    );
  }

  function addRow() {
    setRows((current) => [
      ...current,
      { id: `ingredient-${Date.now()}-${current.length}`, item: "", quantity: "" },
    ]);
  }

  function removeRow(id: string) {
    setRows((current) =>
      current.length === 1 ? current : current.filter((row) => row.id !== id),
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="ka-label">Ingredients</span>
        <button className="ka-button-secondary gap-2" onClick={addRow} type="button">
          <Plus size={15} />
          Add row
        </button>
      </div>
      <div className="mt-2 grid gap-2">
        {rows.map((row, index) => (
          <div
            className="grid gap-2 md:grid-cols-[minmax(0,1fr)_minmax(10rem,16rem)_auto]"
            key={row.id}
          >
            <input
              aria-label={`Ingredient ${index + 1}`}
              className="ka-field"
              name="ingredientItem"
              onChange={(event) => updateRow(row.id, "item", event.target.value)}
              placeholder="Ingredient"
              value={row.item}
            />
            <input
              aria-label={`Ingredient ${index + 1} quantity`}
              className="ka-field"
              name="ingredientQuantity"
              onChange={(event) =>
                updateRow(row.id, "quantity", event.target.value)
              }
              placeholder="Quantity"
              value={row.quantity}
            />
            <button
              aria-label={`Remove ingredient ${index + 1}`}
              className="ka-icon-button"
              disabled={rows.length === 1}
              onClick={() => removeRow(row.id)}
              type="button"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function SavedRecipeForm({
  action,
  recipe,
  submitLabel,
}: {
  action: (payload: FormData) => void;
  recipe: SavedRecipeForForm;
  submitLabel: string;
}) {
  return (
    <form action={action} className="space-y-4">
      {recipe.id ? <input name="recipeId" type="hidden" value={recipe.id} /> : null}
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
        <Field label="Source URL">
          <input
            className="ka-field mt-1"
            defaultValue={recipe.sourceUrl ?? ""}
            name="sourceUrl"
            placeholder="https://..."
            type="url"
          />
        </Field>
        <Field label="Tags">
          <input
            className="ka-field mt-1"
            defaultValue={recipe.tags.join(", ")}
            name="tagsText"
            placeholder="weeknight, freezer, kid favorite"
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

      <IngredientRows recipe={recipe} />

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

      <button className="ka-button gap-2">
        <Save size={16} />
        {submitLabel}
      </button>
    </form>
  );
}

export function SavedRecipeCreateForm() {
  const [state, action, pending] = useActionState(
    createSavedRecipeAction,
    initialState,
  );

  return (
    <>
      <SavedRecipeForm
        action={action}
        recipe={emptyRecipe}
        submitLabel={pending ? "Creating..." : "Create recipe"}
      />
      {state.error ? <div className="ka-error text-sm">{state.error}</div> : null}
      {state.message ? (
        <div className="ka-success text-sm">{state.message}</div>
      ) : null}
    </>
  );
}

export function SavedRecipeEditForm({ recipe }: { recipe: SavedRecipeForForm }) {
  const [state, action, pending] = useActionState(
    updateSavedRecipeAction,
    initialState,
  );

  return (
    <>
      <SavedRecipeForm
        action={action}
        recipe={recipe}
        submitLabel={pending ? "Saving..." : "Save recipe"}
      />
      {state.error ? <div className="ka-error text-sm">{state.error}</div> : null}
      {state.message ? (
        <div className="ka-success text-sm">{state.message}</div>
      ) : null}
    </>
  );
}
