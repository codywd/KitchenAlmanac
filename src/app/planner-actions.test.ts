import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  importPlanningSessionAction,
  savePlanningSessionPlanAction,
  savePlanningSessionPromptAction,
} from "./planner-actions";
import { buildPlanningSessionPrompt } from "@/lib/planning-session";

const actionState = vi.hoisted(() => ({
  context: {
    family: {
      id: "family_1",
      name: "Test Family",
    },
    role: "OWNER" as "ADMIN" | "MEMBER" | "OWNER",
    user: {
      email: "owner@example.local",
      id: "user_owner",
      name: "Owner",
    },
  },
  db: null as ReturnType<typeof makeDb>["db"] | null,
  importResult: {
    importedRecipeCount: 7,
    week: {
      id: "week_1",
      weekStart: new Date("2026-05-04T00:00:00.000Z"),
    },
  },
  revalidated: [] as string[],
  review: {
    blockingIssues: [],
    canImport: true,
  } as {
    blockingIssues: Array<{ title: string }>;
    canImport: boolean;
  },
}));

vi.mock("@/lib/family", async () => {
  const actual = await vi.importActual<typeof import("@/lib/family")>(
    "@/lib/family",
  );

  return {
    ...actual,
    requireFamilyContext: vi.fn(async () => actionState.context),
  };
});

vi.mock("@/lib/db", () => ({
  getDb: vi.fn(() => actionState.db),
}));

vi.mock("@/lib/planning-brief", async () => {
  const actual = await vi.importActual<typeof import("@/lib/planning-brief")>(
    "@/lib/planning-brief",
  );

  return {
    ...actual,
    getLatestFamilyBudgetTargetCents: vi.fn(async () => 35000),
    loadPlanningBriefContext: vi.fn(async () => ({
      activeRejectedMeals: [],
      recentMeals: [],
      recentVotes: [],
    })),
  };
});

vi.mock("@/lib/import-review", async () => {
  const actual = await vi.importActual<typeof import("@/lib/import-review")>(
    "@/lib/import-review",
  );

  return {
    ...actual,
    buildImportReview: vi.fn(() => actionState.review),
  };
});

vi.mock("@/lib/recipe-import-service", () => ({
  importMealPlanForFamily: vi.fn(async () => actionState.importResult),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn((path: string) => actionState.revalidated.push(path)),
}));

function makeSession(
  overrides: Partial<{
    budgetTargetCents: number | null;
    importedWeekId: string | null;
    localNotes: string | null;
    planJsonText: string | null;
    promptMarkdown: string;
    status: "DRAFT" | "IMPORTED" | "PLAN_PASTED";
  }> = {},
) {
  return {
    budgetTargetCents: 35000,
    createdAt: new Date("2026-05-01T12:00:00.000Z"),
    id: "session_1",
    importedWeekId: null,
    localNotes: "Keep Tuesday easy.",
    planJsonText: null,
    promptMarkdown: "## Local Notes\n\nKeep Tuesday easy.\n\n# Meal Planning Brief",
    status: "DRAFT" as const,
    updatedAt: new Date("2026-05-01T12:05:00.000Z"),
    weekStart: new Date("2026-05-04T00:00:00.000Z"),
    ...overrides,
  };
}

function makeDb({
  foundSession = makeSession(),
  updatedSession = makeSession({
    importedWeekId: "week_1",
    status: "IMPORTED",
  }),
  upsertedSession = makeSession(),
}: {
  foundSession?: ReturnType<typeof makeSession> | null;
  updatedSession?: ReturnType<typeof makeSession>;
  upsertedSession?: ReturnType<typeof makeSession>;
} = {}) {
  const db = {
    planningSession: {
      findFirst: vi.fn(async () => foundSession),
      update: vi.fn(async () => updatedSession),
      upsert: vi.fn(async () => upsertedSession),
    },
  };

  return { db };
}

function formData(values: Record<string, string>) {
  const data = new FormData();

  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }

  return data;
}

describe("planning session actions", () => {
  beforeEach(() => {
    actionState.context.role = "OWNER";
    actionState.db = makeDb().db;
    actionState.revalidated = [];
    actionState.review = {
      blockingIssues: [],
      canImport: true,
    };
  });

  it("lets owners save a prompt with local notes in the copied text", async () => {
    const { db } = makeDb();
    actionState.db = db;
    const promptMarkdown = buildPlanningSessionPrompt({
      briefMarkdown: "# Meal Planning Brief",
      localNotes: "Keep Tuesday easy.",
    });

    const result = await savePlanningSessionPromptAction(
      {},
      formData({
        budgetTargetCents: "35000",
        localNotes: "Keep Tuesday easy.",
        promptMarkdown,
        weekStart: "2026-05-04",
      }),
    );

    expect(db.planningSession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          familyId: "family_1",
          localNotes: "Keep Tuesday easy.",
          planJsonText: null,
          promptMarkdown: expect.stringContaining("## Local Notes"),
          status: "DRAFT",
        }),
        update: expect.objectContaining({
          importedWeekId: null,
          localNotes: "Keep Tuesday easy.",
          planJsonText: null,
          promptMarkdown: expect.stringContaining("Keep Tuesday easy."),
          status: "DRAFT",
        }),
      }),
    );
    expect(result.session?.id).toBe("session_1");
    expect(actionState.revalidated).toEqual(
      expect.arrayContaining(["/planner", "/import"]),
    );
  });

  it("forbids members from saving planning sessions", async () => {
    actionState.context.role = "MEMBER";

    await expect(
      savePlanningSessionPromptAction(
        {},
        formData({
          budgetTargetCents: "35000",
          localNotes: "",
          promptMarkdown: "# Meal Planning Brief",
          weekStart: "2026-05-04",
        }),
      ),
    ).rejects.toThrow("Only family owners and admins can manage meal plans.");
  });

  it("saves invalid returned JSON but refuses to import it", async () => {
    const { db } = makeDb({
      foundSession: makeSession({
        planJsonText: "not json",
        status: "PLAN_PASTED",
      }),
      upsertedSession: makeSession({
        planJsonText: "not json",
        status: "PLAN_PASTED",
      }),
    });
    actionState.db = db;

    const saveResult = await savePlanningSessionPlanAction(
      {},
      formData({
        budgetTargetCents: "35000",
        localNotes: "",
        planJsonText: "not json",
        promptMarkdown: "# Meal Planning Brief",
        weekStart: "2026-05-04",
      }),
    );
    const importResult = await importPlanningSessionAction(
      {},
      formData({ sessionId: "session_1" }),
    );

    expect(saveResult.error).toBeUndefined();
    expect(db.planningSession.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          planJsonText: "not json",
          status: "PLAN_PASTED",
        }),
      }),
    );
    expect(importResult.error).toBe(
      "Returned weekly JSON must be valid JSON before importing.",
    );
    expect(db.planningSession.update).not.toHaveBeenCalled();
  });

  it("rebuilds review server-side and blocks imports with blockers", async () => {
    const { db } = makeDb({
      foundSession: makeSession({
        planJsonText: JSON.stringify({ recipes: [] }),
        status: "PLAN_PASTED",
      }),
    });
    actionState.db = db;
    actionState.review = {
      blockingIssues: [{ title: "Duplicate Date" }],
      canImport: false,
    };

    const result = await importPlanningSessionAction(
      {},
      formData({ sessionId: "session_1" }),
    );

    expect(result.error).toBe(
      "Resolve import blockers before saving: Duplicate Date.",
    );
    expect(db.planningSession.update).not.toHaveBeenCalled();
  });

  it("imports a reviewed session and marks it imported", async () => {
    const { db } = makeDb({
      foundSession: makeSession({
        planJsonText: JSON.stringify({ recipes: [{ dinner_title: "Bowls" }] }),
        status: "PLAN_PASTED",
      }),
    });
    actionState.db = db;

    const result = await importPlanningSessionAction(
      {},
      formData({ sessionId: "session_1" }),
    );

    expect(db.planningSession.update).toHaveBeenCalledWith({
      data: {
        importedWeekId: "week_1",
        status: "IMPORTED",
      },
      where: {
        id: "session_1",
      },
    });
    expect(result.weekId).toBe("week_1");
    expect(result.session?.status).toBe("IMPORTED");
    expect(actionState.revalidated).toEqual(
      expect.arrayContaining(["/planner", "/calendar", "/weeks/week_1"]),
    );
  });
});
