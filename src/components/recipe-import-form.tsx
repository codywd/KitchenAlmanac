"use client";

import { Eye, Upload } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import {
  importMealPlanAction,
  type ImportMealPlanActionState,
} from "@/app/meal-actions";
import { ImportReviewPanel } from "@/components/import-review-panel";
import { parseDateOnly } from "@/lib/dates";
import {
  buildImportReview,
  type ImportReview,
  type ImportReviewContext,
} from "@/lib/import-review";
import { parseJsonWithRepair } from "@/lib/json-repair";

const initialState: ImportMealPlanActionState = {};

export function RecipeImportForm({
  defaultWeekStart,
  reviewContext,
}: {
  defaultWeekStart: string;
  reviewContext: ImportReviewContext;
}) {
  const [state, action, pending] = useActionState(
    importMealPlanAction,
    initialState,
  );
  const [planJson, setPlanJson] = useState("");
  const [review, setReview] = useState<ImportReview | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewedKey, setReviewedKey] = useState("");
  const [weekStart, setWeekStart] = useState(defaultWeekStart);
  const reviewKey = `${weekStart}\n${planJson}`;
  const reviewStale = Boolean(review) && reviewedKey !== reviewKey;

  function previewPlan() {
    try {
      const parsedWeekStart = parseDateOnly(weekStart);
      const parsed = parseJsonWithRepair(planJson);
      const nextPlanJson = parsed.text;
      const nextReviewKey = `${weekStart}\n${nextPlanJson}`;
      const nextReview = buildImportReview({
        context: reviewContext,
        plan: parsed.value,
        weekStart: parsedWeekStart,
      });

      if (parsed.repaired) {
        setPlanJson(nextPlanJson);
      }

      setReview(nextReview);
      setReviewedKey(nextReviewKey);
      setReviewError(null);
    } catch (error) {
      setReview(null);
      setReviewedKey("");
      setReviewError(
        error instanceof Error ? error.message : "Could not preview that JSON.",
      );
    }
  }

  return (
    <div className="ka-panel">
      <form action={action} className="space-y-4">
        <label className="block">
          <span className="ka-label">Week start</span>
          <input
            className="ka-field sm:w-72"
            name="weekStart"
            onChange={(event) => setWeekStart(event.target.value)}
            onInput={(event) => setWeekStart(event.currentTarget.value)}
            required
            type="date"
            value={weekStart}
          />
        </label>
        <label className="block">
          <span className="ka-label">
            Meal-plan JSON
          </span>
          <textarea
            className="ka-textarea mt-1 min-h-[520px] font-mono text-xs leading-5"
            name="planJson"
            onChange={(event) => setPlanJson(event.target.value)}
            onInput={(event) => setPlanJson(event.currentTarget.value)}
            placeholder='Paste the JSON object with "schema_version", "weekly_overview", "shopping_list", and "recipes".'
            required
            spellCheck={false}
            value={planJson}
          />
        </label>
        <input
          name="reviewConfirmed"
          type="hidden"
          value={review && !reviewStale && review.canImport ? "true" : "false"}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            className="ka-button-secondary gap-2 disabled:opacity-60"
            disabled={!planJson.trim()}
            onClick={previewPlan}
            type="button"
          >
            <Eye size={16} />
            Preview plan
          </button>
          <button
            className="ka-button gap-2 disabled:opacity-60"
            disabled={pending || !review || reviewStale || !review.canImport}
          >
            <Upload size={16} />
            Import this plan
          </button>
          {state.weekId ? (
            <Link
              className="ka-button-secondary"
              href={`/weeks/${state.weekId}`}
            >
              View imported week
            </Link>
          ) : null}
        </div>
      </form>
      {reviewStale ? (
        <div className="ka-note mt-4 text-sm">
          Preview again before importing; the JSON or target week changed.
        </div>
      ) : null}
      {reviewError ? (
        <div className="ka-error mt-4 text-sm">
          {reviewError}
        </div>
      ) : null}
      {state.error ? (
        <div className="ka-error mt-4 text-sm">
          {state.error}
        </div>
      ) : null}
      {state.message ? (
        <div className="ka-success mt-4 text-sm">
          {state.message}
        </div>
      ) : null}
      {review ? <ImportReviewPanel review={review} /> : null}
    </div>
  );
}
