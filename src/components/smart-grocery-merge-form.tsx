"use client";

import { Lightbulb, PackagePlus } from "lucide-react";
import { useActionState } from "react";

import {
  applySmartGroceryMergeAction,
  type GroceryRefreshActionState,
} from "@/app/grocery-actions";
import type {
  SmartGrocerySuggestion,
  SmartGrocerySuggestions,
} from "@/lib/smart-grocery";

const initialState: GroceryRefreshActionState = {};

function suggestionCount(suggestions: SmartGrocerySuggestions) {
  return (
    suggestions.currentPlanMissing.length +
    suggestions.recurringAdditions.length +
    suggestions.pantryCandidates.length
  );
}

function SuggestionGroup({
  defaultChecked = false,
  emptyText,
  items,
  name,
  title,
}: {
  defaultChecked?: boolean;
  emptyText: string;
  items: SmartGrocerySuggestion[];
  name: string;
  title: string;
}) {
  return (
    <div className="border border-[var(--line)] bg-[rgba(255,253,245,0.44)] p-4">
      <h3 className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
        {title}
      </h3>
      {items.length ? (
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <label
              className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-3 text-sm font-semibold text-[var(--ink)]"
              key={`${name}-${item.canonicalName}`}
            >
              <input
                className="mt-1 size-4 accent-[var(--herb)]"
                defaultChecked={defaultChecked}
                name={name}
                type="checkbox"
                value={item.canonicalName}
              />
              <span>
                <span className="block capitalize">
                  {item.itemName}
                  {item.quantity ? (
                    <span className="text-[var(--muted-ink)]">
                      {" "}
                      / {item.quantity}
                    </span>
                  ) : null}
                </span>
                <span className="mt-1 block text-xs leading-5 text-[var(--muted-ink)]">
                  {item.reason}
                </span>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm font-semibold text-[var(--muted-ink)]">
          {emptyText}
        </p>
      )}
    </div>
  );
}

export function SmartGroceryMergeForm({
  suggestions,
  weekId,
}: {
  suggestions: SmartGrocerySuggestions;
  weekId: string;
}) {
  const [state, action, pending] = useActionState(
    applySmartGroceryMergeAction,
    initialState,
  );
  const totalSuggestions = suggestionCount(suggestions);

  if (totalSuggestions === 0) {
    return (
      <div className="border border-dashed border-[var(--line)] p-4 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
        No smart grocery suggestions right now.
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input name="weekId" type="hidden" value={weekId} />
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div className="flex items-start gap-3">
          <span className="mt-1 text-[var(--tomato)]">
            <Lightbulb size={18} />
          </span>
          <div>
            <h3 className="recipe-display text-2xl font-semibold text-[var(--ink)]">
              Smart grocery merge
            </h3>
            <p className="mt-1 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
              Review suggestions before anything is written.
            </p>
          </div>
        </div>
        <button className="ka-button gap-2 disabled:opacity-60" disabled={pending}>
          <PackagePlus size={16} />
          Apply selected
        </button>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <SuggestionGroup
          defaultChecked
          emptyText="No missing current-plan items."
          items={suggestions.currentPlanMissing}
          name="addCanonicalName"
          title="Current plan"
        />
        <SuggestionGroup
          emptyText="No recurring additions detected."
          items={suggestions.recurringAdditions}
          name="addCanonicalName"
          title="Recent repeats"
        />
        <SuggestionGroup
          emptyText="No pantry candidates detected."
          items={suggestions.pantryCandidates}
          name="pantryCandidateCanonicalName"
          title="Pantry candidates"
        />
      </div>

      {state.error ? <div className="ka-error text-sm">{state.error}</div> : null}
      {state.message ? <div className="ka-success text-sm">{state.message}</div> : null}
    </form>
  );
}
