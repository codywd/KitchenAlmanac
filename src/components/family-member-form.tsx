"use client";

import { useActionState } from "react";

import {
  addFamilyMemberAction,
  type FamilyMemberActionState,
} from "@/app/family-actions";

const initialState: FamilyMemberActionState = {};

export function FamilyMemberForm({ canAddOwner }: { canAddOwner: boolean }) {
  const [state, action, pending] = useActionState(addFamilyMemberAction, initialState);

  return (
    <div className="ka-panel">
      <form action={action} className="grid gap-3 lg:grid-cols-2">
        <label className="block">
          <span className="ka-label">Email</span>
          <input
            autoComplete="email"
            className="ka-field mt-1"
            name="email"
            required
            type="email"
          />
        </label>
        <label className="block">
          <span className="ka-label">Display name</span>
          <input
            autoComplete="name"
            className="ka-field mt-1"
            name="name"
            type="text"
          />
        </label>
        <label className="block">
          <span className="ka-label">Temporary password</span>
          <input
            autoComplete="new-password"
            className="ka-field mt-1"
            minLength={8}
            name="password"
            required
            type="password"
          />
        </label>
        <label className="block">
          <span className="ka-label">Role</span>
          <select className="ka-select mt-1" defaultValue="MEMBER" name="role">
            <option value="MEMBER">Member</option>
            <option value="ADMIN">Admin</option>
            {canAddOwner ? <option value="OWNER">Owner</option> : null}
          </select>
        </label>
        <button className="ka-button disabled:opacity-60 lg:col-start-2" disabled={pending}>
          Add member
        </button>
      </form>
      {state.error ? <div className="ka-error mt-4 text-sm">{state.error}</div> : null}
      {state.message ? (
        <div className="ka-success mt-4 text-sm">{state.message}</div>
      ) : null}
    </div>
  );
}
