import { describe, expect, it } from "vitest";

import { buildQuickCloseoutPrompts } from "./quick-closeout";

describe("quick closeout prompts", () => {
  it("surfaces owner/admin prompts for current and past planned meals", () => {
    const prompts = buildQuickCloseoutPrompts({
      canManage: true,
      days: [
        {
          date: new Date("2026-05-01T00:00:00.000Z"),
          meal: {
            id: "meal_done",
            name: "Done Dinner",
            outcomeStatus: "COOKED",
          },
        },
        {
          date: new Date("2026-05-02T00:00:00.000Z"),
          meal: {
            id: "meal_yesterday",
            name: "Yesterday Bowls",
            outcomeStatus: "PLANNED",
          },
        },
        {
          date: new Date("2026-05-03T00:00:00.000Z"),
          meal: {
            id: "meal_today",
            name: "Today Pasta",
            outcomeStatus: "PLANNED",
          },
        },
        {
          date: new Date("2026-05-04T00:00:00.000Z"),
          meal: {
            id: "meal_future",
            name: "Future Soup",
            outcomeStatus: "PLANNED",
          },
        },
      ],
      now: new Date("2026-05-03T12:00:00.000Z"),
      weekId: "week_1",
    });

    expect(prompts).toEqual([
      {
        date: "2026-05-03",
        href: "/weeks/week_1/closeout?mealId=meal_today#closeout-meal_today",
        mealId: "meal_today",
        mealName: "Today Pasta",
      },
      {
        date: "2026-05-02",
        href: "/weeks/week_1/closeout?mealId=meal_yesterday#closeout-meal_yesterday",
        mealId: "meal_yesterday",
        mealName: "Yesterday Bowls",
      },
    ]);
  });

  it("hides prompts from members", () => {
    const prompts = buildQuickCloseoutPrompts({
      canManage: false,
      days: [
        {
          date: new Date("2026-05-03T00:00:00.000Z"),
          meal: {
            id: "meal_today",
            name: "Today Pasta",
            outcomeStatus: "PLANNED",
          },
        },
      ],
      now: new Date("2026-05-03T12:00:00.000Z"),
      weekId: "week_1",
    });

    expect(prompts).toEqual([]);
  });
});
