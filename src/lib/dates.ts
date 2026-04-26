const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateOnly(value: string) {
  if (!dateOnlyPattern.test(value)) {
    throw new Error("Dates must use YYYY-MM-DD format.");
  }

  return new Date(`${value}T00:00:00.000Z`);
}

export function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function startOfMealPlanWeek(input = new Date()) {
  const date = new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()),
  );
  const day = date.getUTCDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + mondayOffset);

  return date;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);

  return next;
}

export function formatDisplayDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    weekday: "short",
  }).format(date);
}

export function formatMoney(cents?: number | null) {
  if (typeof cents !== "number") {
    return "Not estimated";
  }

  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cents / 100);
}
