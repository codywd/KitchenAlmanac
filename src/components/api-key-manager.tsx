"use client";

import { useActionState } from "react";

import { createApiKeyAction, type ApiKeyActionState } from "@/app/meal-actions";

const initialState: ApiKeyActionState = {};

export function ApiKeyManager() {
  const [state, action, pending] = useActionState(createApiKeyAction, initialState);

  return (
    <div className="ka-panel">
      <form action={action} className="flex flex-col gap-3 sm:flex-row">
        <input
          className="ka-field flex-1"
          name="name"
          placeholder="Outside LLM, phone shortcut, kitchen tablet..."
        />
        <select
          className="ka-field sm:w-40"
          defaultValue="90"
          name="expiresInDays"
        >
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="180">180 days</option>
        </select>
        <button
          className="ka-button disabled:opacity-60"
          disabled={pending}
        >
          Create key
        </button>
      </form>
      {state.error ? (
        <p className="ka-error mt-3 text-sm">{state.error}</p>
      ) : null}
      {state.plainTextKey ? (
        <div className="ka-note mt-4">
          <div className="text-sm font-black text-[var(--ink)]">Copy this now</div>
          <p className="mt-1 text-xs font-semibold text-[var(--muted-ink)]">
            This API key is shown once and is stored only as a hash.
          </p>
          <code className="mt-3 block overflow-x-auto bg-[var(--ink)] p-3 text-xs text-[var(--flour)]">
            {state.plainTextKey}
          </code>
        </div>
      ) : null}
    </div>
  );
}
