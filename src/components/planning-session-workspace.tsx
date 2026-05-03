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
import { parseJsonWithRepair } from "@/lib/json-repair";
import {
  buildMealIdeaPrompt,
  buildPlanningSessionPrompt,
  getPlanningSessionImportGate,
  normalizePlanningJsonText,
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
  selectedMealIdeas,
  weekStart,
}: {
  budgetTargetCents: number | null;
  localNotes: string;
  promptMarkdown: string;
  selectedMealIdeas: string;
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
      <input name="selectedMealIdeas" type="hidden" value={selectedMealIdeas} />
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
  const [selectedMealIdeas, setSelectedMealIdeas] = useState(
    initialSession?.selectedMealIdeas ?? "",
  );
  const [planJsonText, setPlanJsonText] = useState(
    initialSession?.planJsonText ?? "",
  );
  const [ideaCopyStatus, setIdeaCopyStatus] = useState<
    "copied" | "idle" | "selected"
  >("idle");
  const [recipeCopyStatus, setRecipeCopyStatus] = useState<
    "copied" | "idle" | "selected"
  >("idle");
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
  const ideaPromptMarkdown = useMemo(
    () =>
      buildMealIdeaPrompt({
        briefMarkdown,
        localNotes,
      }),
    [briefMarkdown, localNotes],
  );
  const recipePromptMarkdown = useMemo(
    () =>
      buildPlanningSessionPrompt({
        briefMarkdown,
        localNotes,
        selectedMealIdeas,
      }),
    [briefMarkdown, localNotes, selectedMealIdeas],
  );
  const currentSession =
    importState.session ?? planState.session ?? promptState.session ?? initialSession;
  const reviewKey = `${weekStart}\n${normalizePlanningJsonText(planJsonText)}`;
  const reviewStale = Boolean(review) && reviewedKey !== reviewKey;
  const importGate = getPlanningSessionImportGate({
    currentPlanJsonText: planJsonText,
    reviewCanImport: review?.canImport ?? null,
    reviewStale,
    session: currentSession
      ? {
          id: currentSession.id,
          planJsonText: currentSession.planJsonText,
        }
      : null,
  });
  const canImport =
    !importPending &&
    importGate.canImport;
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

  async function copyPrompt({
    setStatus,
    value,
  }: {
    setStatus: (status: "copied" | "idle" | "selected") => void;
    value: string;
  }) {
    try {
      const copied = await writeClipboardText(value);

      if (!copied) {
        setStatus("selected");
        setCopyError("Clipboard was blocked, so select and copy the prompt below.");

        return;
      }

      setStatus("copied");
      setCopyError(null);
      window.setTimeout(() => setStatus("idle"), 1800);
    } catch {
      setStatus("selected");
      setCopyError("Clipboard was blocked, so select and copy the prompt below.");
    }
  }

  function previewPlan() {
    try {
      const parsed = parseJsonWithRepair(planJsonText);
      const nextPlanJsonText = parsed.text;
      const nextReviewKey = `${weekStart}\n${nextPlanJsonText}`;
      const nextReview = buildImportReview({
        context: reviewContext,
        plan: parsed.value,
        weekStart: new Date(`${weekStart}T00:00:00.000Z`),
      });

      if (nextPlanJsonText !== planJsonText) {
        setPlanJsonText(nextPlanJsonText);
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

      <form action={savePromptAction} className="space-y-5">
        <HiddenSessionFields
          budgetTargetCents={budgetTargetCents}
          localNotes={localNotes}
          promptMarkdown={recipePromptMarkdown}
          selectedMealIdeas={selectedMealIdeas}
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

        <div className="space-y-3 border-t border-[var(--line)] pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="ka-label">Phase 1: idea prompt</span>
            <button
              className="ka-button-secondary gap-2 disabled:opacity-60"
              onClick={() =>
                void copyPrompt({
                  setStatus: setIdeaCopyStatus,
                  value: ideaPromptMarkdown,
                })
              }
              type="button"
            >
              {ideaCopyStatus === "copied" ? (
                <Check size={16} />
              ) : (
                <ClipboardCopy size={16} />
              )}
              {ideaCopyStatus === "copied" ? "Copied" : "Copy idea prompt"}
            </button>
          </div>
          <textarea
            className="ka-textarea min-h-[20rem] font-mono text-xs leading-5"
            readOnly
            value={ideaPromptMarkdown}
          />
        </div>

        <label className="block border-t border-[var(--line)] pt-5">
          <span className="ka-label">Selected meal ideas</span>
          <textarea
            className="ka-textarea mt-1 min-h-32 text-sm leading-6"
            name="visibleSelectedMealIdeas"
            onChange={(event) => setSelectedMealIdeas(event.target.value)}
            placeholder="Paste or edit the meal names and overviews you want turned into recipes."
            value={selectedMealIdeas}
          />
        </label>

        <div className="space-y-3 border-t border-[var(--line)] pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="ka-label">Phase 2: recipe JSON prompt</span>
            <button
              className="ka-button gap-2 disabled:opacity-60"
              disabled={promptPending}
              onClick={() =>
                void copyPrompt({
                  setStatus: setRecipeCopyStatus,
                  value: recipePromptMarkdown,
                })
              }
              type="submit"
            >
              {recipeCopyStatus === "copied" ? (
                <Check size={16} />
              ) : (
                <ClipboardCopy size={16} />
              )}
              {recipeCopyStatus === "copied"
                ? "Copied and saved"
                : "Save and copy recipe prompt"}
            </button>
          </div>
          <textarea
            className="ka-textarea min-h-[26rem] font-mono text-xs leading-5"
            readOnly
            value={recipePromptMarkdown}
          />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
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
      </form>

      <form action={savePlanAction} className="space-y-4 border-t border-[var(--line)] pt-6">
        <HiddenSessionFields
          budgetTargetCents={budgetTargetCents}
          localNotes={localNotes}
          promptMarkdown={recipePromptMarkdown}
          selectedMealIdeas={selectedMealIdeas}
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
      {importGate.hasUnsavedPlanChanges ? (
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
            disabled={!canImport}
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
