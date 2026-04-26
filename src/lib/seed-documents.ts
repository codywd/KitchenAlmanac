import { readFile } from "node:fs/promises";
import path from "node:path";

export type SeedDocumentKind =
  | "HOUSEHOLD_PROFILE"
  | "MEDICAL_GUIDELINES"
  | "BATCH_PREP_PATTERNS";

type SkillReference = {
  fileName: string;
  kind: SeedDocumentKind;
  title: string;
};

const references: SkillReference[] = [
  {
    fileName: "household-profile.md",
    kind: "HOUSEHOLD_PROFILE",
    title: "Household Profile",
  },
  {
    fileName: "medical-guidelines.md",
    kind: "MEDICAL_GUIDELINES",
    title: "Medical Nutritional Guidelines",
  },
  {
    fileName: "batch-prep-patterns.md",
    kind: "BATCH_PREP_PATTERNS",
    title: "Batch Prep Patterns",
  },
];

export async function loadSkillReferenceDocuments(skillDir: string) {
  const referenceDir = path.join(skillDir, "references");

  return Promise.all(
    references.map(async (reference) => ({
      content: await readFile(path.join(referenceDir, reference.fileName), "utf8"),
      kind: reference.kind,
      title: reference.title,
    })),
  );
}
