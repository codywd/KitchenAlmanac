"use client";

import { useActionState } from "react";

import {
  changePasswordAction,
  type PasswordChangeState,
} from "@/app/account-actions";

const initialState: PasswordChangeState = {};

export function PasswordChangeForm() {
  const [state, action, pending] = useActionState(changePasswordAction, initialState);

  return (
    <div className="ka-panel">
      <form action={action} className="space-y-4">
        <label className="block">
          <span className="ka-label">Current password</span>
          <input
            autoComplete="current-password"
            className="ka-field mt-1"
            name="currentPassword"
            required
            type="password"
          />
        </label>
        <label className="block">
          <span className="ka-label">New password</span>
          <input
            autoComplete="new-password"
            className="ka-field mt-1"
            minLength={8}
            name="newPassword"
            required
            type="password"
          />
        </label>
        <button className="ka-button disabled:opacity-60" disabled={pending}>
          Update password
        </button>
      </form>
      {state.error ? <div className="ka-error mt-4 text-sm">{state.error}</div> : null}
      {state.message ? (
        <div className="ka-success mt-4 text-sm">{state.message}</div>
      ) : null}
    </div>
  );
}
