import { describe, expect, it } from "vitest";

import {
  buildMealIdeaPrompt,
  buildPlanningSessionPrompt,
  normalizePlanningJsonText,
  planningJsonTextsMatch,
} from "./planning-session";

const sourceBrief = [
  "# Meal Planning Brief",
  "Family: Test Family",
  "Target week: 2026-05-04 through 2026-05-10",
  "Budget target: $350",
  "Use this source material directly.",
  "## Household Guidance",
  "No fish. Keep weeknight active prep under 30 minutes.",
].join("\n\n");

describe("planning session prompts", () => {
  it("builds a phase one prompt for lightweight meal ideas only", () => {
    const prompt = buildMealIdeaPrompt({
      briefMarkdown: sourceBrief,
      localNotes: "Use freezer chicken early in the week.",
    });

    expect(prompt).toContain("# Phase 1: Meal Idea Brainstorm");
    expect(prompt).toContain("Name");
    expect(prompt).toContain("Overview");
    expect(prompt).toContain("Do not write full recipes");
    expect(prompt).toContain("Use freezer chicken early in the week.");
    expect(prompt).toContain("# Meal Planning Brief");
    expect(prompt).not.toContain("schema_version");
    expect(prompt).not.toContain("Return only JSON");
  });

  it("builds a phase two prompt around selected ideas and the import JSON contract", () => {
    const prompt = buildPlanningSessionPrompt({
      briefMarkdown: sourceBrief,
      localNotes: "Keep Tuesday very fast.",
      selectedMealIdeas:
        "Monday - Turkey Rice Bowls: familiar, cheap, and good for leftovers.",
    });

    expect(prompt).toContain("# Phase 2: Recipe Design And Import JSON");
    expect(prompt).toContain("## Selected Meal Ideas");
    expect(prompt).toContain(
      "Monday - Turkey Rice Bowls: familiar, cheap, and good for leftovers.",
    );
    expect(prompt).toContain("Keep Tuesday very fast.");
    expect(prompt).toContain("Return only JSON");
    expect(prompt).toContain('"schema_version": "1.0"');
    expect(prompt).toContain("Create one dinner plan for each date");
  });
});

describe("planning session JSON matching", () => {
  it("matches saved JSON against textarea text with harmless whitespace", () => {
    const savedText = '{"recipes":[{"dinner_title":"Turkey Bowls"}]}';
    const textareaText = `\n${savedText}\n\n`;

    expect(planningJsonTextsMatch(savedText, textareaText)).toBe(true);
  });

  it("matches saved JSON against repairable fenced textarea text", () => {
    const savedText = '{"recipes":[{"dinner_title":"Turkey Bowls"}]}';
    const textareaText = [
      "```json",
      '{“recipes”:[{“dinner_title”:“Turkey Bowls”,}]}',
      "```",
    ].join("\n");

    expect(normalizePlanningJsonText(textareaText)).toBe(savedText);
    expect(planningJsonTextsMatch(savedText, textareaText)).toBe(true);
  });
});
