"use client";

import type { MealFeedbackStatus, MealOutcomeStatus } from "@prisma/client";
import { CheckCircle2 } from "lucide-react";
import { useActionState } from "react";

import {
  saveMealOutcomeAction,
  type MealOutcomeActionState,
} from "@/app/closeout-actions";

const initialState: MealOutcomeActionState = {};

const outcomeOptions: Array<{ label: string; value: MealOutcomeStatus }> = [
  { label: "Needs closeout", value: "PLANNED" },
  { label: "Cooked", value: "COOKED" },
  { label: "Leftovers", value: "LEFTOVERS" },
  { label: "Skipped", value: "SKIPPED" },
  { label: "Replaced", value: "REPLACED" },
];

const feedbackOptions: Array<{ label: string; value: MealFeedbackStatus }> = [
  { label: "Planned", value: "PLANNED" },
  { label: "Liked", value: "LIKED" },
  { label: "Worked with tweaks", value: "WORKED_WITH_TWEAKS" },
  { label: "Rejected", value: "REJECTED" },
];

function dollars(cents: number | null) {
  return typeof cents === "number" ? (cents / 100).toFixed(2) : "";
}

export function MealOutcomeForm({
  meal,
  variant = "full",
  weekId,
}: {
  meal: {
    actualCostCents: number | null;
    feedbackReason: string | null;
    feedbackStatus: MealFeedbackStatus;
    feedbackTweaks: string | null;
    id: string;
    leftoverNotes: string | null;
    outcomeNotes: string | null;
    outcomeStatus: MealOutcomeStatus;
  };
  variant?: "compact" | "full";
  weekId: string;
}) {
  const [state, action, pending] = useActionState(
    saveMealOutcomeAction,
    initialState,
  );

  if (variant === "compact") {
    return (
      <form action={action} className="space-y-4">
        <input name="mealId" type="hidden" value={meal.id} />
        <input name="weekId" type="hidden" value={weekId} />

        <div className="grid gap-2 sm:grid-cols-2">
          {outcomeOptions
            .filter((option) => option.value !== "PLANNED")
            .map((option) => (
              <button
                className="ka-button-secondary justify-center gap-2 disabled:opacity-60"
                disabled={pending}
                key={option.value}
                name="outcomeStatus"
                type="submit"
                value={option.value}
              >
                <CheckCircle2 size={15} />
                {option.label}
              </button>
            ))}
        </div>

        <details className="border-t border-[var(--line)] pt-3">
          <summary className="cursor-pointer text-sm font-black text-[var(--herb-dark)]">
            Add details
          </summary>
          <div className="mt-3 space-y-4">
            <label className="block">
              <span className="ka-label">Actual cost</span>
              <input
                className="ka-field mt-1"
                defaultValue={dollars(meal.actualCostCents)}
                inputMode="decimal"
                min="0"
                name="actualCostDollars"
                placeholder="18.75"
                step="0.01"
                type="number"
              />
            </label>
            <label className="block">
              <span className="ka-label">Outcome notes</span>
              <textarea
                className="ka-textarea mt-1 min-h-20 text-sm"
                defaultValue={meal.outcomeNotes ?? ""}
                name="outcomeNotes"
                placeholder="What actually happened?"
              />
            </label>
            <label className="block">
              <span className="ka-label">Leftovers</span>
              <textarea
                className="ka-textarea mt-1 min-h-20 text-sm"
                defaultValue={meal.leftoverNotes ?? ""}
                name="leftoverNotes"
                placeholder="Lunches, freezer portions, or waste notes."
              />
            </label>
            <label className="block">
              <span className="ka-label">Memory status</span>
              <select
                className="ka-select mt-1"
                defaultValue={meal.feedbackStatus}
                name="feedbackStatus"
              >
                {feedbackOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="ka-label">Reason</span>
              <textarea
                className="ka-textarea mt-1 min-h-20 text-sm"
                defaultValue={meal.feedbackReason ?? ""}
                name="feedbackReason"
                placeholder="Why did it work or fail?"
              />
            </label>
            <label className="block">
              <span className="ka-label">Tweaks</span>
              <textarea
                className="ka-textarea mt-1 min-h-20 text-sm"
                defaultValue={meal.feedbackTweaks ?? ""}
                name="feedbackTweaks"
                placeholder="What should change next time?"
              />
            </label>
            <label className="block">
              <span className="ka-label">Pattern to avoid</span>
              <input
                className="ka-field mt-1"
                name="patternToAvoid"
                placeholder="For rejected meals"
              />
            </label>
            <label className="flex items-start gap-2 text-sm font-semibold text-[var(--muted-ink)]">
              <input
                className="mt-1 size-4 accent-[var(--tomato)]"
                name="createRejectedPattern"
                type="checkbox"
              />
              Add rejected meals pattern when memory status is rejected.
            </label>
          </div>
        </details>

        {state.error ? <div className="ka-error text-sm">{state.error}</div> : null}
        {state.message ? <div className="ka-success text-sm">{state.message}</div> : null}
      </form>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input name="mealId" type="hidden" value={meal.id} />
      <input name="weekId" type="hidden" value={weekId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="ka-label">Outcome</span>
          <select
            className="ka-select mt-1"
            defaultValue={meal.outcomeStatus}
            name="outcomeStatus"
          >
            {outcomeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="ka-label">Actual cost</span>
          <input
            className="ka-field mt-1"
            defaultValue={dollars(meal.actualCostCents)}
            inputMode="decimal"
            min="0"
            name="actualCostDollars"
            placeholder="18.75"
            step="0.01"
            type="number"
          />
        </label>
      </div>

      <label className="block">
        <span className="ka-label">Outcome notes</span>
        <textarea
          className="ka-textarea mt-1 min-h-20 text-sm"
          defaultValue={meal.outcomeNotes ?? ""}
          name="outcomeNotes"
          placeholder="What actually happened?"
        />
      </label>

      <label className="block">
        <span className="ka-label">Leftovers</span>
        <textarea
          className="ka-textarea mt-1 min-h-20 text-sm"
          defaultValue={meal.leftoverNotes ?? ""}
          name="leftoverNotes"
          placeholder="Lunches, freezer portions, or waste notes."
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="ka-label">Memory status</span>
          <select
            className="ka-select mt-1"
            defaultValue={meal.feedbackStatus}
            name="feedbackStatus"
          >
            {feedbackOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="ka-label">Pattern to avoid</span>
          <input
            className="ka-field mt-1"
            name="patternToAvoid"
            placeholder="For rejected meals"
          />
        </label>
      </div>

      <label className="block">
        <span className="ka-label">Reason</span>
        <textarea
          className="ka-textarea mt-1 min-h-20 text-sm"
          defaultValue={meal.feedbackReason ?? ""}
          name="feedbackReason"
          placeholder="Why did it work or fail?"
        />
      </label>

      <label className="block">
        <span className="ka-label">Tweaks</span>
        <textarea
          className="ka-textarea mt-1 min-h-20 text-sm"
          defaultValue={meal.feedbackTweaks ?? ""}
          name="feedbackTweaks"
          placeholder="What should change next time?"
        />
      </label>

      <label className="flex items-center gap-2 text-sm font-semibold text-[var(--muted-ink)]">
        <input
          className="size-4 accent-[var(--tomato)]"
          name="createRejectedPattern"
          type="checkbox"
        />
        Add rejected meals pattern when memory status is rejected.
      </label>

      <button className="ka-button w-full gap-2 disabled:opacity-60" disabled={pending}>
        <CheckCircle2 size={16} />
        Save closeout
      </button>

      {state.error ? <div className="ka-error text-sm">{state.error}</div> : null}
      {state.message ? <div className="ka-success text-sm">{state.message}</div> : null}
    </form>
  );
}
