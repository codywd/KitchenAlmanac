"use client";

import { Eye, Upload } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import {
  importSavedRecipeJsonAction,
  type SavedRecipeActionState,
} from "@/app/recipe-actions";
import { parseJsonWithRepair } from "@/lib/json-repair";
import { normalizeImportedSavedRecipe } from "@/lib/recipe-import";

const initialState: SavedRecipeActionState = {};

type RecipePreview = {
  costEstimateCents?: number;
  ingredientCount: number;
  methodStepCount: number;
  name: string;
  servings: number;
  tags: string[];
};

function formatMoney(cents?: number) {
  return typeof cents === "number" ? `$${(cents / 100).toFixed(2)}` : "No estimate";
}

function previewFromRecipeJson(recipeJson: string): {
  preview: RecipePreview;
  repairedText: string;
} {
  const parsed = parseJsonWithRepair(recipeJson);
  const recipe = normalizeImportedSavedRecipe({ recipe: parsed.value });

  return {
    preview: {
      costEstimateCents: recipe.costEstimateCents,
      ingredientCount: recipe.ingredients.length,
      methodStepCount: recipe.methodSteps.length,
      name: recipe.name,
      servings: recipe.servings,
      tags: recipe.tags,
    },
    repairedText: parsed.text,
  };
}

export function SavedRecipeJsonImportForm() {
  const [state, action, pending] = useActionState(
    importSavedRecipeJsonAction,
    initialState,
  );
  const [preview, setPreview] = useState<RecipePreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [recipeJson, setRecipeJson] = useState("");

  function previewRecipe() {
    try {
      const result = previewFromRecipeJson(recipeJson);

      setRecipeJson(result.repairedText);
      setPreview(result.preview);
      setPreviewError(null);
    } catch (error) {
      setPreview(null);
      setPreviewError(
        error instanceof Error ? error.message : "Could not preview that recipe JSON.",
      );
    }
  }

  return (
    <div className="ka-panel">
      <form action={action} className="space-y-4">
        <label className="block">
          <span className="ka-label">Structured recipe JSON</span>
          <textarea
            className="ka-textarea mt-1 min-h-80 font-mono text-xs leading-5"
            name="recipeJson"
            onChange={(event) => setRecipeJson(event.target.value)}
            onInput={(event) => setRecipeJson(event.currentTarget.value)}
            placeholder='{"dinner_title":"Recipe name","ingredients":[{"name":"Ingredient"}],"instructions":[{"text":"Cook."}]}'
            required
            spellCheck={false}
            value={recipeJson}
          />
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            className="ka-button-secondary gap-2 disabled:opacity-60"
            disabled={!recipeJson.trim()}
            onClick={previewRecipe}
            type="button"
          >
            <Eye size={16} />
            Preview recipe
          </button>
          <button
            className="ka-button gap-2 disabled:opacity-60"
            disabled={pending || !recipeJson.trim()}
          >
            <Upload size={16} />
            {pending ? "Importing..." : "Import recipe"}
          </button>
          {state.recipeId ? (
            <Link
              className="ka-button-secondary"
              href={`/recipes?menu=edit&recipeId=${state.recipeId}#recipe-${state.recipeId}-edit`}
            >
              View recipe
            </Link>
          ) : null}
        </div>
      </form>
      {previewError ? (
        <div className="ka-error mt-4 text-sm">{previewError}</div>
      ) : null}
      {state.error ? <div className="ka-error mt-4 text-sm">{state.error}</div> : null}
      {state.message ? (
        <div className="ka-success mt-4 text-sm">{state.message}</div>
      ) : null}
      {preview ? (
        <div className="ka-note mt-4 grid gap-2 text-sm">
          <div className="font-black text-[var(--ink)]">{preview.name}</div>
          <div>
            Serves {preview.servings} | {preview.ingredientCount} ingredients |{" "}
            {preview.methodStepCount} steps | {formatMoney(preview.costEstimateCents)}
          </div>
          {preview.tags.length ? <div>Tags: {preview.tags.join(", ")}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
