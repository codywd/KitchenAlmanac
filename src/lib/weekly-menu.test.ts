import { describe, expect, it } from "vitest";

import {
  buildWeeklyDinnerMenuView,
  type WeeklyDinnerMenuWeek,
} from "./weekly-menu";

function meal(
  overrides: {
    batchPrepNote?: string | null;
    name?: string;
    sourceRecipe?: unknown;
    validationNotes?: string | null;
  } = {},
) {
  return {
    batchPrepNote: "Chop vegetables after breakfast.",
    name: "Turkey Rice Bowls",
    sourceRecipe: null,
    validationNotes: null,
    ...overrides,
  };
}

function week(overrides: Partial<WeeklyDinnerMenuWeek> = {}): WeeklyDinnerMenuWeek {
  return {
    days: [
      {
        date: new Date("2026-05-04T00:00:00.000Z"),
        dinner: meal(),
      },
    ],
    id: "week_1",
    title: null,
    weekStart: new Date("2026-05-04T00:00:00.000Z"),
    ...overrides,
  };
}

describe("weekly dinner menu", () => {
  it("builds seven ordered printable dinner slots from the week start", () => {
    const view = buildWeeklyDinnerMenuView(
      week({
        days: [
          {
            date: new Date("2026-05-06T00:00:00.000Z"),
            dinner: meal({
              batchPrepNote: "Marinate chicken in the morning.",
              name: "Chicken Fajitas",
            }),
          },
          {
            date: new Date("2026-05-04T00:00:00.000Z"),
            dinner: meal({ name: "Turkey Rice Bowls" }),
          },
          {
            date: new Date("2026-05-10T00:00:00.000Z"),
            dinner: meal({ batchPrepNote: null, name: "Bean Chili" }),
          },
        ],
      }),
    );

    expect(view).toMatchObject({
      rangeLabel: "May 4 - May 10, 2026",
      weekEnd: "2026-05-10",
      weekStart: "2026-05-04",
      weekTitle: "Week of 2026-05-04",
    });
    expect(view.days).toHaveLength(7);
    expect(view.days.map((day) => day.date)).toEqual([
      "2026-05-04",
      "2026-05-05",
      "2026-05-06",
      "2026-05-07",
      "2026-05-08",
      "2026-05-09",
      "2026-05-10",
    ]);
    expect(view.days[0]).toMatchObject({
      dateLabel: "May 4",
      dinnerName: "Turkey Rice Bowls",
      hasDinner: true,
      prepNote: "Chop vegetables after breakfast.",
      weekday: "Monday",
    });
    expect(view.days[2]).toMatchObject({
      dinnerName: "Chicken Fajitas",
      prepNote: "Marinate chicken in the morning.",
      weekday: "Wednesday",
    });
    expect(view.days[6]).toMatchObject({
      dinnerName: "Bean Chili",
      hasPrepNote: false,
      prepNote: "Prep note TBD",
      weekday: "Sunday",
    });
  });

  it("keeps partial weeks printable with missing dinner and prep placeholders", () => {
    const view = buildWeeklyDinnerMenuView(
      week({
        days: [
          {
            date: new Date("2026-05-05T00:00:00.000Z"),
            dinner: meal({
              batchPrepNote: "  ",
              name: "Pasta Night",
            }),
          },
        ],
        title: "Busy week dinners",
      }),
    );

    expect(view.weekTitle).toBe("Busy week dinners");
    expect(view.days[0]).toMatchObject({
      dinnerName: "No dinner planned",
      hasDinner: false,
      hasPrepNote: false,
      prepNote: "Prep note TBD",
    });
    expect(view.days[1]).toMatchObject({
      dinnerName: "Pasta Night",
      hasDinner: true,
      hasPrepNote: false,
      prepNote: "Prep note TBD",
    });
  });

  it("adds short descriptions from stored recipe source text when available", () => {
    const view = buildWeeklyDinnerMenuView(
      week({
        days: [
          {
            date: new Date("2026-05-04T00:00:00.000Z"),
            dinner: meal({
              sourceRecipe: {
                description:
                  "A colorful bowl with seasoned turkey, brown rice, and crisp vegetables.",
                why_this_works: "This should not win over a direct description.",
              },
            }),
          },
          {
            date: new Date("2026-05-05T00:00:00.000Z"),
            dinner: meal({
              name: "Chicken Fajitas",
              sourceRecipe: {
                why_this_works:
                  "Fast skillet chicken with peppers, warm spices, and flexible toppings for everyone.",
              },
            }),
          },
          {
            date: new Date("2026-05-06T00:00:00.000Z"),
            dinner: meal({
              name: "Bean Chili",
              sourceRecipe: {},
              validationNotes:
                "A hearty bean chili built for leftovers.\n\nCody plate: Add greens.",
            }),
          },
          {
            date: new Date("2026-05-07T00:00:00.000Z"),
            dinner: meal({
              name: "Very Long Dinner",
              sourceRecipe: {
                summary:
                  "This dinner has a long stored summary that should be shortened enough to fit inside the printable weekly menu without crowding the whole layout or pushing prep notes off the page.",
              },
            }),
          },
        ],
      }),
    );

    expect(view.days[0]).toMatchObject({
      description:
        "A colorful bowl with seasoned turkey, brown rice, and crisp vegetables.",
      hasDescription: true,
    });
    expect(view.days[1]).toMatchObject({
      description:
        "Fast skillet chicken with peppers, warm spices, and flexible toppings for everyone.",
      hasDescription: true,
    });
    expect(view.days[2]).toMatchObject({
      description: "A hearty bean chili built for leftovers.",
      hasDescription: true,
    });
    expect(view.days[3].description.length).toBeLessThanOrEqual(128);
    expect(view.days[4]).toMatchObject({
      description: null,
      hasDescription: false,
    });
  });
});
