"use client";

import { Plus } from "lucide-react";
import { useActionState } from "react";

import {
  addPantryStapleAction,
  type PantryStapleActionState,
} from "@/app/shopping-actions";
import { OnlineOnlySubmitButton } from "@/components/online-only-submit-button";

const initialState: PantryStapleActionState = {};

export function PantryStapleForm() {
  const [state, action, pending] = useActionState(
    addPantryStapleAction,
    initialState,
  );

  return (
    <div className="ka-panel border border-[var(--line)]">
      <form action={action} className="flex flex-col gap-3 sm:flex-row">
        <label className="block flex-1">
          <span className="ka-label">Pantry staple</span>
          <input
            className="ka-field"
            name="displayName"
            placeholder="Olive oil, rice, taco seasoning"
            required
          />
        </label>
        <OnlineOnlySubmitButton
          className="ka-button gap-2 self-end disabled:opacity-60"
          pending={pending}
        >
          <Plus size={16} />
          Add staple
        </OnlineOnlySubmitButton>
      </form>
      {state.error ? <div className="ka-error mt-3 text-sm">{state.error}</div> : null}
      {state.message ? (
        <div className="ka-success mt-3 text-sm">{state.message}</div>
      ) : null}
    </div>
  );
}
