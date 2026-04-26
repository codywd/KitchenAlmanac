"use client";

import { Check, ClipboardCopy, Eye, Save, Upload } from "lucide-react";
import Link from "next/link";
import { useActionState, useMemo, useState } from "react";

import {
  importPlanningSessionAction,
  savePlanningSessionPlanAction,
  savePlanningSessionPromptAction,
  type PlanningSessionActionState,
} from "@/app/planner-actions";
import { ImportReviewPanel } from "@/components/import-review-panel";
import {
  buildImportReview,
  type ImportReview,
  type ImportReviewContext,
} from "@/lib/import-review";
import {
  buildPlanningSessionPrompt,
  type PlanningSessionView,
} from "@/lib/planning-session";

const initialActionState: PlanningSessionActionState = {};

function statusLabel(status?: PlanningSessionView["status"]) {
  if (status === "IMPORTED") {
    return "Imported";
  }

  if (status === "PLAN_PASTED") {
    return "Plan pasted";
  }

  return "Draft";
}

function HiddenSessionFields({
  budgetTargetCents,
  localNotes,
  promptMarkdown,
  weekStart,
}: {
  budgetTargetCents: number | null;
  localNotes: string;
  promptMarkdown: string;
  weekStart: string;
}) {
  return (
    <>
      <input name="weekStart" type="hidden" value={weekStart} />
      <input
        name="budgetTargetCents"
        type="hidden"
        value={budgetTargetCents ?? ""}
      />
      <input name="localNotes" type="hidden" value={localNotes} />
      <textarea hidden name="promptMarkdown" readOnly value={promptMarkdown} />
    </>
  );
}

export function PlanningSessionWorkspace({
  briefMarkdown,
  budgetTargetCents,
  generatedAt,
  initialSession,
  reviewContext,
  weekEnd,
  weekStart,
}: {
  briefMarkdown: string;
  budgetTargetCents: number | null;
  generatedAt: string;
  initialSession: PlanningSessionView | null;
  reviewContext: ImportReviewContext;
  weekEnd: string;
  weekStart: string;
}) {
  const [localNotes, setLocalNotes] = useState(initialSession?.localNotes ?? "");
  const [planJsonText, setPlanJsonText] = useState(
    initialSession?.planJsonText ?? "",
  );
  const [copyStatus, setCopyStatus] = useState<"copied" | "idle" | "selected">(
    "idle",
  );
  const [copyError, setCopyError] = useState<string | null>(null);
  const [review, setReview] = useState<ImportReview | null>(null);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewedKey, setReviewedKey] = useState("");
  const [promptState, savePromptAction, promptPending] = useActionState(
    savePlanningSessionPromptAction,
    initialActionState,
  );
  const [planState, savePlanAction, planPending] = useActionState(
    savePlanningSessionPlanAction,
    initialActionState,
  );
  const [importState, importAction, importPending] = useActionState(
    importPlanningSessionAction,
    initialActionState,
  );
  const promptMarkdown = useMemo(
    () =>
      buildPlanningSessionPrompt({
        briefMarkdown,
        localNotes,
      }),
    [briefMarkdown, localNotes],
  );
  const currentSession =
    importState.session ?? planState.session ?? promptState.session ?? initialSession;
  const reviewKey = `${weekStart}\n${planJsonText}`;
  const reviewStale = Boolean(review) && reviewedKey !== reviewKey;
  const savedPlanMatches =
    Boolean(currentSession?.planJsonText.trim()) &&
    currentSession?.planJsonText.trim() === planJsonText.trim();
  const canImport =
    Boolean(currentSession?.id) &&
    Boolean(review) &&
    !reviewStale &&
    Boolean(review?.canImport) &&
    savedPlanMatches;
  const importedWeekId =
    importState.weekId ??
    importState.session?.importedWeekId ??
    currentSession?.importedWeekId;
  const currentStatus = currentSession?.status;

  async function writeClipboardText(value: string) {
    try {
      await navigator.clipboard.writeText(value);

      return true;
    } catch {
      const clipboardProxy = document.createElement("textarea");
      clipboardProxy.value = value;
      clipboardProxy.setAttribute("readonly", "");
      clipboardProxy.style.left = "-9999px";
      clipboardProxy.style.position = "fixed";
      clipboardProxy.style.top = "0";
      document.body.appendChild(clipboardProxy);
      clipboardProxy.focus();
      clipboardProxy.select();

      try {
        return document.execCommand("copy");
      } finally {
        document.body.removeChild(clipboardProxy);
      }
    }
  }

  async function copyPrompt() {
    try {
      const copied = await writeClipboardText(promptMarkdown);

      if (!copied) {
        setCopyStatus("selected");
        setCopyError("Clipboard was blocked, so select and copy the prompt below.");

        return;
      }

      setCopyStatus("copied");
      setCopyError(null);
      window.setTimeout(() => setCopyStatus("idle"), 1800);
    } catch {
      setCopyStatus("selected");
      setCopyError("Clipboard was blocked, so select and copy the prompt below.");
    }
  }

  function previewPlan() {
    try {
      const plan = JSON.parse(planJsonText) as unknown;
      const nextReview = buildImportReview({
        context: reviewContext,
        plan,
        weekStart: new Date(`${weekStart}T00:00:00.000Z`),
      });

      setReview(nextReview);
      setReviewedKey(reviewKey);
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
    <div className="ka-panel space-y-6">
      <div className="flex flex-col gap-3 border-b border-[var(--line)] pb-5 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
            Planning session
          </div>
          <h2 className="recipe-display mt-1 text-3xl font-semibold text-[var(--ink)]">
            {weekStart} / {weekEnd}
          </h2>
          <p className="mt-2 text-sm font-semibold text-[var(--muted-ink)]">
            Generated{" "}
            {new Intl.DateTimeFormat("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date(generatedAt))}
          </p>
        </div>
        <div className="inline-flex w-fit border border-[var(--line)] px-3 py-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
          {statusLabel(currentStatus)}
        </div>
      </div>

      <form action={savePromptAction} className="space-y-4">
        <HiddenSessionFields
          budgetTargetCents={budgetTargetCents}
          localNotes={localNotes}
          promptMarkdown={promptMarkdown}
          weekStart={weekStart}
        />
        <label className="block">
          <span className="ka-label">Local notes</span>
          <textarea
            className="ka-textarea mt-1 min-h-24 text-sm leading-6"
            name="visibleLocalNotes"
            onChange={(event) => setLocalNotes(event.target.value)}
            placeholder="Optional notes to prepend when copying."
            value={localNotes}
          />
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            className="ka-button gap-2 disabled:opacity-60"
            disabled={promptPending}
            onClick={() => void copyPrompt()}
            type="submit"
          >
            {copyStatus === "copied" ? <Check size={16} /> : <ClipboardCopy size={16} />}
            {copyStatus === "copied" ? "Copied and saved" : "Save and copy prompt"}
          </button>
          {promptState.message ? (
            <span className="ka-success text-sm">{promptState.message}</span>
          ) : null}
          {promptState.error ? (
            <span className="ka-error text-sm">{promptState.error}</span>
          ) : null}
        </div>
        {copyError ? (
          <p className="text-sm font-semibold text-[var(--muted-ink)]">
            {copyError}
          </p>
        ) : null}
        <label className="block">
          <span className="ka-label">ChatGPT prompt</span>
          <textarea
            className="ka-textarea mt-1 min-h-[26rem] font-mono text-xs leading-5"
            readOnly
            value={promptMarkdown}
          />
        </label>
      </form>

      <form action={savePlanAction} className="space-y-4 border-t border-[var(--line)] pt-6">
        <HiddenSessionFields
          budgetTargetCents={budgetTargetCents}
          localNotes={localNotes}
          promptMarkdown={promptMarkdown}
          weekStart={weekStart}
        />
        <label className="block">
          <span className="ka-label">Returned weekly JSON</span>
          <textarea
            className="ka-textarea mt-1 min-h-[26rem] font-mono text-xs leading-5"
            name="planJsonText"
            onChange={(event) => setPlanJsonText(event.target.value)}
            onInput={(event) => setPlanJsonText(event.currentTarget.value)}
            placeholder='Paste the JSON object with "schema_version", "weekly_overview", "shopping_list", and "recipes".'
            spellCheck={false}
            value={planJsonText}
          />
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            className="ka-button-secondary gap-2 disabled:opacity-60"
            disabled={!planJsonText.trim()}
            onClick={previewPlan}
            type="button"
          >
            <Eye size={16} />
            Preview plan
          </button>
          <button
            className="ka-button-secondary gap-2 disabled:opacity-60"
            disabled={planPending || !planJsonText.trim()}
            type="submit"
          >
            <Save size={16} />
            Save returned JSON
          </button>
          {planState.message ? (
            <span className="ka-success text-sm">{planState.message}</span>
          ) : null}
          {planState.error ? (
            <span className="ka-error text-sm">{planState.error}</span>
          ) : null}
        </div>
      </form>

      {reviewStale ? (
        <div className="ka-note text-sm">
          Preview again before importing; the returned JSON changed.
        </div>
      ) : null}
      {review && !savedPlanMatches ? (
        <div className="ka-note text-sm">
          Save the returned JSON before importing this reviewed plan.
        </div>
      ) : null}
      {reviewError ? <div className="ka-error text-sm">{reviewError}</div> : null}
      {review ? <ImportReviewPanel review={review} /> : null}

      <form action={importAction} className="border-t border-[var(--line)] pt-6">
        <input name="sessionId" type="hidden" value={currentSession?.id ?? ""} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <button
            className="ka-button gap-2 disabled:opacity-60"
            disabled={importPending || !canImport}
            type="submit"
          >
            <Upload size={16} />
            Import reviewed plan
          </button>
          {importedWeekId ? (
            <Link className="ka-button-secondary" href={`/weeks/${importedWeekId}`}>
              View imported week
            </Link>
          ) : null}
          {importState.message ? (
            <span className="ka-success text-sm">{importState.message}</span>
          ) : null}
          {importState.error ? (
            <span className="ka-error text-sm">{importState.error}</span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
