import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { loadSkillReferenceDocuments } from "./seed-documents";

describe("seed document loader", () => {
  it("loads KitchenAlmanac guidance references into named household documents", async () => {
    const skillDir = await mkdtemp(path.join(tmpdir(), "kitchenalmanac-skill-"));
    const referencesDir = path.join(skillDir, "references");

    await import("node:fs/promises").then(({ mkdir }) =>
      mkdir(referencesDir, { recursive: true }),
    );
    await writeFile(
      path.join(referencesDir, "household-profile.md"),
      "# Household Profile\nFamily details",
    );
    await writeFile(
      path.join(referencesDir, "medical-guidelines.md"),
      "# Medical Nutritional Guidelines\nGuidelines",
    );
    await writeFile(
      path.join(referencesDir, "batch-prep-patterns.md"),
      "# Batch Prep Patterns\nPrep notes",
    );

    const documents = await loadSkillReferenceDocuments(skillDir);

    expect(documents.map((document) => document.kind)).toEqual([
      "HOUSEHOLD_PROFILE",
      "MEDICAL_GUIDELINES",
      "BATCH_PREP_PATTERNS",
    ]);
    expect(documents[0]).toMatchObject({
      title: "Household Profile",
      content: "# Household Profile\nFamily details",
    });

    await rm(skillDir, { recursive: true, force: true });
  });
});
