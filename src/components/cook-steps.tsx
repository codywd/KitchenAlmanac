"use client";

import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Timer,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { CookStep } from "@/lib/cook-view";

function formatSeconds(value: number) {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function CookSteps({ steps }: { steps: CookStep[] }) {
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const currentStep = steps[currentIndex];
  const completedCount = useMemo(
    () => steps.filter((step) => completed[step.id]).length,
    [completed, steps],
  );

  useEffect(() => {
    if (seconds <= 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      setSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [seconds]);

  return (
    <section className="text-[var(--ink)]">
      <div className="flex flex-col justify-between gap-3 border-b border-[var(--line)] pb-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--tomato)]">
            Cook flow
          </p>
          <h2 className="recipe-display mt-1 text-2xl font-semibold">
            Method
          </h2>
        </div>
        <div className="flex items-center gap-2 text-sm font-black text-[var(--muted-ink)]">
          <CheckCircle2 size={16} />
          {completedCount}/{steps.length}
        </div>
      </div>

      <div className="divide-y divide-[var(--line)]">
        {steps.map((step, index) => {
          const isActive = index === currentIndex;
          const isDone = completed[step.id] ?? false;

          return (
            <article
              className={`py-5 transition ${
                isActive
                  ? "bg-[rgba(245,200,91,0.18)]"
                  : isDone
                    ? "bg-[rgba(66,102,63,0.12)]"
                    : "hover:bg-[rgba(255,253,245,0.42)]"
              }`}
              key={step.id}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <button
                  className={`grid size-10 shrink-0 place-items-center rounded-full border text-sm font-bold ${
                    isActive
                      ? "border-[var(--tomato)] bg-[var(--tomato)] text-[var(--flour)]"
                      : "border-[var(--brass)] text-[var(--muted-ink)]"
                  }`}
                  onClick={() => setCurrentIndex(index)}
                  type="button"
                >
                  {step.number}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="recipe-display text-2xl leading-8">{step.text}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
                    {step.timeMinutes ? (
                      <span>
                        {step.timeMinutes} min
                      </span>
                    ) : null}
                    {step.heat ? (
                      <span>
                        {step.heat}
                      </span>
                    ) : null}
                  </div>
                </div>
                <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm font-black text-[var(--herb-dark)]">
                  <input
                    checked={isDone}
                    className="size-5 accent-[var(--herb)] transition-transform checked:scale-110"
                    onChange={(event) =>
                      setCompleted((current) => ({
                        ...current,
                        [step.id]: event.target.checked,
                      }))
                    }
                    type="checkbox"
                  />
                  Done
                </label>
              </div>
            </article>
          );
        })}
      </div>

      <div className="sticky bottom-4 mt-5 border border-[var(--line-strong)] bg-[var(--ink)] p-3 text-[var(--flour)] shadow-2xl shadow-black/25">
        <div className="grid gap-3 md:grid-cols-[auto_minmax(0,1fr)_auto] md:items-center">
          <div className="flex items-center gap-2">
            <button
              className="inline-flex size-10 items-center justify-center border border-[rgba(255,253,245,0.18)] text-[var(--flour)] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
              type="button"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="inline-flex size-10 items-center justify-center border border-[rgba(255,253,245,0.18)] text-[var(--flour)] transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={currentIndex >= steps.length - 1}
              onClick={() =>
                setCurrentIndex((index) => Math.min(steps.length - 1, index + 1))
              }
              type="button"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="min-w-0">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-[var(--blush)]">
              Current step
            </div>
            <div className="mt-1 truncate text-sm font-semibold">
              {currentStep ? `Step ${currentStep.number}: ${currentStep.text}` : "No step"}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              className="inline-flex min-h-10 items-center gap-2 bg-[var(--blush)] px-3 text-sm font-black text-[var(--ink)] transition hover:bg-[var(--paper-deep)] disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!currentStep?.timeMinutes}
              onClick={() => setSeconds((currentStep?.timeMinutes ?? 0) * 60)}
              type="button"
            >
              <Timer size={16} />
              {seconds > 0 ? formatSeconds(seconds) : "Timer"}
            </button>
            <button
              className="inline-flex size-10 items-center justify-center border border-[rgba(255,253,245,0.18)] text-[var(--flour)] transition hover:bg-white/10"
              onClick={() => setSeconds(0)}
              type="button"
            >
              <RotateCcw size={16} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
