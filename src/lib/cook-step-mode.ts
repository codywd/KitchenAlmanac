import type { CookStep } from "./cook-view";
import { routeWithParams } from "./routed-menu";

const emptyStep: CookStep = {
  id: "no-method-steps",
  number: 1,
  text: "No method steps are saved for this meal yet.",
};

export type CookStepMode = {
  currentIndex: number;
  currentStep: CookStep;
  isFinalStep: boolean;
  stepNumber: number;
  steps: CookStep[];
  totalSteps: number;
};

function stepNumberFromParam(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number(rawValue);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function cookStepHref(mealId: string, stepNumber: number) {
  return routeWithParams(`/cook/${mealId}`, {}, {
    mode: "steps",
    step: String(stepNumber),
  });
}

export function cookStepProgressKey(mealId: string) {
  return `kitchenalmanac:cook:${mealId}`;
}

export function buildCookStepMode({
  stepParam,
  steps,
}: {
  mealId: string;
  stepParam: string | string[] | undefined;
  steps: CookStep[];
}): CookStepMode {
  const normalizedSteps = steps.length ? steps : [emptyStep];
  const requestedStepNumber = stepNumberFromParam(stepParam);
  const stepNumber = Math.min(
    normalizedSteps.length,
    Math.max(1, requestedStepNumber),
  );
  const currentIndex = stepNumber - 1;

  return {
    currentIndex,
    currentStep: normalizedSteps[currentIndex],
    isFinalStep: currentIndex === normalizedSteps.length - 1,
    stepNumber,
    steps: normalizedSteps,
    totalSteps: normalizedSteps.length,
  };
}
