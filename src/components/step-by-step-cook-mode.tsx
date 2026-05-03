"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ListChecks,
  RotateCcw,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useReducer, useState } from "react";

import type { CookIngredient, CookStep } from "@/lib/cook-view";
import {
  buildCookStepMode,
  cookStepHref,
  cookStepProgressKey,
} from "@/lib/cook-step-mode";

type SavedCookProgress = {
  checkedIngredientIds?: string[];
  completedStepIds?: string[];
};

type CookProgressState = {
  checkedIngredients: Record<string, boolean>;
  completedSteps: Record<string, boolean>;
  mealId: string | null;
};

type CookProgressAction =
  | {
      mealId: string;
      saved: SavedCookProgress;
      type: "load";
    }
  | {
      checked: boolean;
      id: string;
      type: "setIngredient";
    }
  | {
      id: string;
      type: "toggleStep";
    }
  | {
      mealId: string;
      type: "reset";
    };

type CookTimerState = {
  active: boolean;
  secondsLeft: number;
  stepId: string | null;
};

type CookTimerAction =
  | {
      defaultSeconds: number;
      stepId: string;
      type: "tick";
    }
  | {
      defaultSeconds: number;
      stepId: string;
      type: "toggle";
    }
  | {
      seconds: number;
      stepId: string;
      type: "reset";
    };

function mapFromIds(ids?: string[]) {
  return Object.fromEntries((ids ?? []).map((id) => [id, true]));
}

function idsFromMap(values: Record<string, boolean>) {
  return Object.entries(values)
    .filter(([, value]) => value)
    .map(([id]) => id);
}

function cookProgressReducer(
  state: CookProgressState,
  action: CookProgressAction,
): CookProgressState {
  if (action.type === "load") {
    return {
      checkedIngredients: mapFromIds(action.saved.checkedIngredientIds),
      completedSteps: mapFromIds(action.saved.completedStepIds),
      mealId: action.mealId,
    };
  }

  if (action.type === "reset") {
    return {
      checkedIngredients: {},
      completedSteps: {},
      mealId: action.mealId,
    };
  }

  if (action.type === "setIngredient") {
    return {
      ...state,
      checkedIngredients: {
        ...state.checkedIngredients,
        [action.id]: action.checked,
      },
    };
  }

  return {
    ...state,
    completedSteps: {
      ...state.completedSteps,
      [action.id]: !state.completedSteps[action.id],
    },
  };
}

function timerForStep(
  state: CookTimerState,
  stepId: string,
  defaultSeconds: number,
) {
  return state.stepId === stepId
    ? state
    : {
        active: false,
        secondsLeft: defaultSeconds,
        stepId,
      };
}

function cookTimerReducer(
  state: CookTimerState,
  action: CookTimerAction,
): CookTimerState {
  if (action.type === "reset") {
    return {
      active: false,
      secondsLeft: action.seconds,
      stepId: action.stepId,
    };
  }

  const current = timerForStep(
    state,
    action.stepId,
    action.defaultSeconds,
  );

  if (action.type === "toggle") {
    return {
      ...current,
      active: current.secondsLeft > 0 ? !current.active : false,
    };
  }

  const secondsLeft = Math.max(0, current.secondsLeft - 1);

  return {
    ...current,
    active: current.active && secondsLeft > 0,
    secondsLeft,
  };
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function parseSavedProgress(value: string | null): SavedCookProgress {
  if (!value) {
    return {};
  }

  try {
    const parsed = JSON.parse(value) as SavedCookProgress;

    return {
      checkedIngredientIds: Array.isArray(parsed.checkedIngredientIds)
        ? parsed.checkedIngredientIds.filter((id) => typeof id === "string")
        : [],
      completedStepIds: Array.isArray(parsed.completedStepIds)
        ? parsed.completedStepIds.filter((id) => typeof id === "string")
        : [],
    };
  } catch {
    return {};
  }
}

export function StepByStepCookMode({
  children,
  dateLabel,
  ingredients,
  initialStepNumber,
  mealId,
  normalHref,
  steps,
  title,
  weekHref,
}: {
  children?: ReactNode;
  dateLabel: string;
  ingredients: CookIngredient[];
  initialStepNumber: number;
  mealId: string;
  normalHref: string;
  steps: CookStep[];
  title: string;
  weekHref: string;
}) {
  const router = useRouter();
  const [stepNumber, setStepNumber] = useState(initialStepNumber);
  const [progress, dispatchProgress] = useReducer(cookProgressReducer, {
    checkedIngredients: {},
    completedSteps: {},
    mealId: null,
  });
  const [timer, dispatchTimer] = useReducer(cookTimerReducer, {
    active: false,
    secondsLeft: 0,
    stepId: null,
  });
  const mode = useMemo(
    () =>
      buildCookStepMode({
        mealId,
        stepParam: String(stepNumber),
        steps,
      }),
    [mealId, stepNumber, steps],
  );
  const stepSeconds = (mode.currentStep.timeMinutes ?? 0) * 60;
  const currentTimer = timerForStep(timer, mode.currentStep.id, stepSeconds);
  const checkedIngredients =
    progress.mealId === mealId ? progress.checkedIngredients : {};
  const completedSteps = progress.mealId === mealId ? progress.completedSteps : {};
  const checkedIngredientCount = ingredients.filter(
    (ingredient) => checkedIngredients[ingredient.id],
  ).length;
  const completedStepCount = mode.steps.filter((step) => completedSteps[step.id]).length;

  useEffect(() => {
    const saved = parseSavedProgress(
      window.localStorage.getItem(cookStepProgressKey(mealId)),
    );

    dispatchProgress({
      mealId,
      saved,
      type: "load",
    });
  }, [mealId]);

  useEffect(() => {
    if (progress.mealId !== mealId) {
      return;
    }

    window.localStorage.setItem(
      cookStepProgressKey(mealId),
      JSON.stringify({
        checkedIngredientIds: idsFromMap(progress.checkedIngredients),
        completedStepIds: idsFromMap(progress.completedSteps),
      }),
    );
  }, [mealId, progress]);

  useEffect(() => {
    if (!currentTimer.active || currentTimer.secondsLeft <= 0) {
      return;
    }

    const timerId = window.setInterval(() => {
      dispatchTimer({
        defaultSeconds: stepSeconds,
        stepId: mode.currentStep.id,
        type: "tick",
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [currentTimer.active, currentTimer.secondsLeft, mode.currentStep.id, stepSeconds]);

  function goToStep(nextStepNumber: number) {
    const boundedStepNumber = Math.min(
      mode.totalSteps,
      Math.max(1, nextStepNumber),
    );

    setStepNumber(boundedStepNumber);
    router.replace(cookStepHref(mealId, boundedStepNumber), { scroll: false });
  }

  function toggleStepComplete(stepId: string) {
    dispatchProgress({
      id: stepId,
      type: "toggleStep",
    });
  }

  function resetProgress() {
    dispatchProgress({
      mealId,
      type: "reset",
    });
    dispatchTimer({
      seconds: stepSeconds,
      stepId: mode.currentStep.id,
      type: "reset",
    });
  }

  return (
    <div className="cook-surface -m-[clamp(1.25rem,3vw,2.5rem)] min-h-[calc(100vh-3rem)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-[1500px] flex-col gap-5">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <Link className="ka-button-secondary gap-2" href={weekHref}>
              <ArrowLeft size={16} />
              Week
            </Link>
            <Link className="ka-button-secondary gap-2" href={normalHref}>
              <X size={16} />
              Exit steps
            </Link>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
            <span>{dateLabel}</span>
            <span>/</span>
            <span>
              Step {mode.stepNumber} of {mode.totalSteps}
            </span>
            <span>/</span>
            <span>{completedStepCount} done</span>
          </div>
        </header>

        <main className="grid flex-1 gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="flex min-h-[520px] flex-col border border-[var(--line-strong)] bg-[rgba(255,253,245,0.78)] p-5 shadow-[0_24px_60px_rgba(58,43,30,0.12)] sm:p-7">
            <div className="flex flex-col justify-between gap-4 border-b border-[var(--line)] pb-5 lg:flex-row lg:items-start">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.14em] text-[var(--herb-dark)]">
                  {title}
                </div>
                <h1 className="recipe-display mt-2 text-4xl font-semibold leading-tight text-[var(--ink)] md:text-6xl">
                  Step {mode.stepNumber}
                </h1>
              </div>
              <button
                className="ka-button-secondary gap-2 self-start"
                onClick={() => toggleStepComplete(mode.currentStep.id)}
                type="button"
              >
                <CheckCircle2 size={16} />
                {completedSteps[mode.currentStep.id] ? "Marked done" : "Mark done"}
              </button>
            </div>

            <div className="flex flex-1 items-center py-8">
              <p className="max-w-5xl text-3xl font-semibold leading-snug text-[var(--ink)] md:text-5xl md:leading-tight">
                {mode.currentStep.text}
              </p>
            </div>

            {mode.currentStep.heat || mode.currentStep.timeMinutes ? (
              <div className="grid gap-3 border-y border-[var(--line)] py-4 md:grid-cols-2">
                {mode.currentStep.heat ? (
                  <div>
                    <div className="ka-label">Heat</div>
                    <div className="mt-1 text-lg font-black text-[var(--ink)]">
                      {mode.currentStep.heat}
                    </div>
                  </div>
                ) : null}
                {mode.currentStep.timeMinutes ? (
                  <div>
                    <div className="ka-label">Timer</div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex min-h-10 items-center gap-2 border border-[var(--line)] px-3 text-lg font-black text-[var(--ink)]">
                        <Clock3 size={17} />
                        {formatTimer(currentTimer.secondsLeft)}
                      </span>
                      <button
                        className="ka-button-secondary"
                        onClick={() =>
                          dispatchTimer({
                            defaultSeconds: stepSeconds,
                            stepId: mode.currentStep.id,
                            type: "toggle",
                          })
                        }
                        type="button"
                      >
                        {currentTimer.active ? "Pause" : "Start"}
                      </button>
                      <button
                        className="ka-button-secondary gap-2"
                        onClick={() => {
                          dispatchTimer({
                            seconds: stepSeconds,
                            stepId: mode.currentStep.id,
                            type: "reset",
                          });
                        }}
                        type="button"
                      >
                        <RotateCcw size={15} />
                        Reset
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <button
                className="ka-button-secondary gap-2 disabled:opacity-50"
                disabled={mode.stepNumber === 1}
                onClick={() => goToStep(mode.stepNumber - 1)}
                type="button"
              >
                <ChevronLeft size={16} />
                Previous
              </button>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {mode.steps.map((step) => (
                  <button
                    aria-label={`Open step ${step.number}`}
                    className={`size-9 border text-sm font-black ${
                      step.number === mode.stepNumber
                        ? "border-[var(--tomato)] bg-[rgba(194,82,51,0.14)] text-[var(--tomato)]"
                        : completedSteps[step.id]
                          ? "border-[var(--herb)] bg-[rgba(66,102,63,0.12)] text-[var(--herb-dark)]"
                          : "border-[var(--line)] text-[var(--muted-ink)]"
                    }`}
                    key={step.id}
                    onClick={() => goToStep(step.number)}
                    type="button"
                  >
                    {step.number}
                  </button>
                ))}
              </div>
              <button
                className="ka-button gap-2 disabled:opacity-50"
                disabled={mode.isFinalStep}
                onClick={() => goToStep(mode.stepNumber + 1)}
                type="button"
              >
                Next
                <ChevronRight size={16} />
              </button>
            </div>
          </section>

          <aside className="space-y-5">
            <details className="ka-panel border border-[var(--line)]" open>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                <span>
                  <span className="ka-label">Ingredients</span>
                  <span className="mt-1 block text-lg font-black text-[var(--ink)]">
                    {checkedIngredientCount}/{ingredients.length} checked
                  </span>
                </span>
                <ListChecks className="text-[var(--herb)]" size={19} />
              </summary>
              <div className="mt-4 max-h-[420px] divide-y divide-[var(--line)] overflow-auto">
                {ingredients.map((ingredient) => (
                  <label
                    className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-3 py-3 text-sm font-semibold text-[var(--ink)]"
                    key={ingredient.id}
                  >
                    <input
                      checked={checkedIngredients[ingredient.id] ?? false}
                      className="mt-1 size-4 accent-[var(--herb)]"
                      onChange={(event) =>
                        dispatchProgress({
                          checked: event.target.checked,
                          id: ingredient.id,
                          type: "setIngredient",
                        })
                      }
                      type="checkbox"
                    />
                    <span>
                      <span className="block">
                        {ingredient.name}
                        <span className="text-[var(--tomato)]">
                          {" "}
                          / {ingredient.quantity}
                        </span>
                      </span>
                      {ingredient.preparation ? (
                        <span className="mt-1 block text-xs leading-5 text-[var(--muted-ink)]">
                          {ingredient.preparation}
                        </span>
                      ) : null}
                    </span>
                  </label>
                ))}
              </div>
              <button
                className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-black text-[var(--herb-dark)]"
                onClick={resetProgress}
                type="button"
              >
                <RotateCcw size={15} />
                Reset progress
              </button>
            </details>

            {mode.isFinalStep ? children : null}

            {!mode.isFinalStep ? (
              <Link className="ka-button-secondary w-full justify-center gap-2" href={normalHref}>
                Normal cook view
                <ArrowRight size={16} />
              </Link>
            ) : null}
          </aside>
        </main>
      </div>
    </div>
  );
}
