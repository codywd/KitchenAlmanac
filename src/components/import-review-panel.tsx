"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";

import { formatMoney } from "@/lib/dates";
import type { ImportReview, ImportReviewIssue } from "@/lib/import-review";

function issueTone(issue: ImportReviewIssue) {
  if (issue.severity === "blocker") {
    return "border-[var(--tomato)] text-[var(--tomato-dark)]";
  }

  if (issue.severity === "warning") {
    return "border-[var(--brass)] text-[var(--muted-ink)]";
  }

  return "border-[var(--herb)] text-[var(--herb-dark)]";
}

function ReviewIssueList({
  issues,
  title,
}: {
  issues: ImportReviewIssue[];
  title: string;
}) {
  if (!issues.length) {
    return null;
  }

  return (
    <div>
      <h3 className="text-sm font-black uppercase tracking-[0.12em] text-[var(--ink)]">
        {title}
      </h3>
      <div className="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">
        {issues.map((issue, index) => (
          <div className="py-3" key={`${issue.title}-${issue.mealName}-${index}`}>
            <div
              className={`inline-flex border-l-2 px-2 py-1 text-xs font-black uppercase tracking-[0.12em] ${issueTone(
                issue,
              )}`}
            >
              {issue.severity} / {issue.title}
            </div>
            <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
              {[issue.date, issue.mealName].filter(Boolean).join(" / ")}
              {issue.date || issue.mealName ? ": " : ""}
              {issue.detail}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ImportReviewPanel({ review }: { review: ImportReview }) {
  const blockers = review.issues.filter((issue) => issue.severity === "blocker");
  const warnings = review.issues.filter((issue) => issue.severity === "warning");
  const notes = review.issues.filter((issue) => issue.severity === "info");

  return (
    <div className="mt-6 space-y-6 border-t border-[var(--line)] pt-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="recipe-display text-3xl font-semibold text-[var(--ink)]">
            {review.title}
          </h3>
          <p className="mt-1 text-sm font-semibold text-[var(--muted-ink)]">
            {review.weekStart} / {review.weekEnd}
          </p>
        </div>
        <div
          className={`inline-flex items-center gap-2 text-sm font-black ${
            review.canImport ? "text-[var(--herb-dark)]" : "text-[var(--tomato-dark)]"
          }`}
        >
          {review.canImport ? <CheckCircle2 size={17} /> : <AlertTriangle size={17} />}
          {review.canImport ? "Ready to import" : "Resolve blockers first"}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="border border-[var(--line)] p-4">
          <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
            Dinners
          </div>
          <div className="mt-2 text-2xl font-black text-[var(--ink)]">
            {review.recipeCount}
          </div>
        </div>
        <div className="border border-[var(--line)] p-4">
          <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
            Budget
          </div>
          <div className="mt-2 text-2xl font-black text-[var(--ink)]">
            {formatMoney(review.estimatedGroceryTotalCents)}
          </div>
          <div className="mt-1 text-xs font-semibold text-[var(--muted-ink)]">
            Target {formatMoney(review.budgetTargetCents)}
          </div>
        </div>
        <div className="border border-[var(--line)] p-4">
          <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
            Groceries
          </div>
          <div className="mt-2 text-2xl font-black text-[var(--ink)]">
            {review.grocerySummary.itemCount}
          </div>
          <div className="mt-1 text-xs font-semibold text-[var(--muted-ink)]">
            {review.grocerySummary.sectionCount} sections
          </div>
        </div>
        <div className="border border-[var(--line)] p-4">
          <div className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
            Issues
          </div>
          <div className="mt-2 text-2xl font-black text-[var(--ink)]">
            {blockers.length} / {warnings.length}
          </div>
          <div className="mt-1 text-xs font-semibold text-[var(--muted-ink)]">
            blockers / warnings
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
        {review.dayPreviews.map((day) => (
          <div
            className="border border-[var(--line)] bg-[rgba(255,253,245,0.4)] p-3"
            key={`${day.date}-${day.mealName}`}
          >
            <div className="text-xs font-black uppercase tracking-[0.08em] text-[var(--muted-ink)]">
              {day.date}
            </div>
            <h3 className="mt-2 text-sm font-black leading-5 text-[var(--ink)]">
              {day.mealName}
            </h3>
            <p className="mt-2 text-xs font-semibold text-[var(--muted-ink)]">
              {formatMoney(day.costEstimateCents)}
            </p>
            <div className="mt-3 flex flex-wrap gap-1">
              {day.flags.slice(0, 3).map((flag) => (
                <span className="ka-status-mark" data-tone="muted" key={flag}>
                  {flag}
                </span>
              ))}
            </div>
            {day.issueCount ? (
              <div className="mt-3 text-xs font-black uppercase tracking-[0.12em] text-[var(--tomato-dark)]">
                {day.issueCount} issue{day.issueCount === 1 ? "" : "s"}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <ReviewIssueList issues={blockers} title="Blockers" />
      <ReviewIssueList issues={warnings} title="Warnings" />
      <ReviewIssueList issues={notes} title="Helpful Signals" />
    </div>
  );
}
