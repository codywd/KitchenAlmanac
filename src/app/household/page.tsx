import { saveHouseholdDocumentAction } from "@/app/meal-actions";
import { AppShell } from "@/components/app-shell";
import { PageIntro } from "@/components/page-intro";
import { Section } from "@/components/section";
import { getDb } from "@/lib/db";
import { canManageGuidance, requireFamilyContext } from "@/lib/family";

export const dynamic = "force-dynamic";

const kindLabels = {
  BATCH_PREP_PATTERNS: "Batch Prep Patterns",
  HOUSEHOLD_PROFILE: "Household Profile",
  MEDICAL_GUIDELINES: "Medical Guidelines",
};

export default async function HouseholdPage() {
  const context = await requireFamilyContext("/household");
  const canManage = canManageGuidance(context.role);
  const documents = await getDb().householdDocument.findMany({
    orderBy: {
      kind: "asc",
    },
    where: {
      familyId: context.family.id,
    },
  });

  return (
    <AppShell family={context.family} role={context.role} user={context.user}>
      <div className="ka-page">
      <PageIntro eyebrow="Planning source of truth" title="Household guidance">
          These seeded documents are returned from `/api/household-profile` and guide
          external meal generation. They are planning metadata, not clinical advice;
          doctor-provided targets should override the defaults here.
      </PageIntro>

      <div className="grid gap-5">
        {documents.map((document) => (
          <Section
            description={`Kind: ${document.kind}`}
            key={document.id}
            title={kindLabels[document.kind]}
          >
            {canManage ? (
              <form action={saveHouseholdDocumentAction} className="space-y-3">
                <input name="id" type="hidden" value={document.id} />
                <textarea
                  className="ka-textarea min-h-80 font-mono text-sm leading-6"
                  name="content"
                  defaultValue={document.content}
                />
                <button className="ka-button">
                  Save document
                </button>
              </form>
            ) : (
              <div className="whitespace-pre-wrap font-mono text-sm leading-6 text-[var(--muted-ink)]">
                {document.content}
              </div>
            )}
          </Section>
        ))}
        {documents.length === 0 ? (
          <Section title="No Guidance Seeded">
            <p className="text-sm text-[var(--muted-ink)]">
              Run `npm run db:seed` after configuring the database to import the
              KitchenAlmanac guidance references.
            </p>
          </Section>
        ) : null}
      </div>
      </div>
    </AppShell>
  );
}
