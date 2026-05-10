import { addDays, toDateOnly } from "./dates";

const prepNotePlaceholder = "Prep note TBD";
const noDinnerPlaceholder = "No dinner planned";

export type WeeklyDinnerMenuMeal = {
  batchPrepNote: string | null;
  name: string;
  sourceRecipe?: unknown;
  validationNotes?: string | null;
};

export type WeeklyDinnerMenuWeek = {
  days: Array<{
    date: Date;
    dinner: WeeklyDinnerMenuMeal | null;
  }>;
  id: string;
  title: string | null;
  weekStart: Date;
};

export type WeeklyDinnerMenuDay = {
  date: string;
  dateLabel: string;
  description: string | null;
  dinnerName: string;
  hasDescription: boolean;
  hasDinner: boolean;
  hasPrepNote: boolean;
  prepNote: string;
  weekday: string;
};

export type WeeklyDinnerMenuView = {
  days: WeeklyDinnerMenuDay[];
  rangeLabel: string;
  weekEnd: string;
  weekId: string;
  weekStart: string;
  weekTitle: string;
};

function formatMonthDay(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function formatYear(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    year: "numeric",
  }).format(date);
}

function formatWeekday(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    weekday: "long",
  }).format(date);
}

function formatRange(start: Date, end: Date) {
  const startYear = formatYear(start);
  const endYear = formatYear(end);
  const startLabel = formatMonthDay(start);
  const endLabel = `${formatMonthDay(end)}, ${endYear}`;

  return startYear === endYear
    ? `${startLabel} - ${endLabel}`
    : `${startLabel}, ${startYear} - ${endLabel}`;
}

function trimmedText(value: string | null | undefined) {
  const text = value?.trim();

  return text ? text : null;
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function firstTextField(
  record: Record<string, unknown> | null,
  keys: string[],
) {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string") {
      const text = trimmedText(value);

      if (text) {
        return text;
      }
    }
  }

  return null;
}

function firstParagraph(value: string) {
  return value.split(/\n\s*\n/u)[0]?.trim() ?? value;
}

function firstSentence(value: string) {
  return firstParagraph(value).match(/.+?[.!?](?:\s|$)/u)?.[0].trim() ?? firstParagraph(value);
}

function compactDescription(value: string | null) {
  const text = value?.replace(/\s+/gu, " ").trim();

  if (!text) {
    return null;
  }

  const sentence = firstSentence(text);
  const maxLength = 128;

  if (sentence.length <= maxLength) {
    return sentence;
  }

  const shortened = sentence.slice(0, maxLength - 3);
  const lastSpace = shortened.lastIndexOf(" ");
  const cleanEnd = lastSpace > 80 ? shortened.slice(0, lastSpace) : shortened;

  return `${cleanEnd.replace(/[,. ;:]+$/u, "")}...`;
}

function mealDescription(meal: WeeklyDinnerMenuMeal | null) {
  if (!meal) {
    return null;
  }

  const sourceRecipe = asRecord(meal.sourceRecipe);

  return compactDescription(
    firstTextField(sourceRecipe, [
      "description",
      "summary",
      "shortDescription",
      "short_description",
      "meal_description",
      "why_this_works",
    ]) ?? trimmedText(meal.validationNotes),
  );
}

export function buildWeeklyDinnerMenuView(
  week: WeeklyDinnerMenuWeek,
): WeeklyDinnerMenuView {
  const weekStart = week.weekStart;
  const weekEnd = addDays(weekStart, 6);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = addDays(weekStart, index);
    const dinner =
      week.days.find((day) => toDateOnly(day.date) === toDateOnly(date))?.dinner ??
      null;
    const description = mealDescription(dinner);
    const prepNote = trimmedText(dinner?.batchPrepNote);

    return {
      date: toDateOnly(date),
      dateLabel: formatMonthDay(date),
      description,
      dinnerName: dinner?.name ?? noDinnerPlaceholder,
      hasDescription: Boolean(description),
      hasDinner: Boolean(dinner),
      hasPrepNote: Boolean(prepNote),
      prepNote: prepNote ?? prepNotePlaceholder,
      weekday: formatWeekday(date),
    };
  });

  return {
    days,
    rangeLabel: formatRange(weekStart, weekEnd),
    weekEnd: toDateOnly(weekEnd),
    weekId: week.id,
    weekStart: toDateOnly(weekStart),
    weekTitle: week.title ?? `Week of ${toDateOnly(weekStart)}`,
  };
}
