import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { PageIntro } from "@/components/page-intro";
import { SavedRecipeCreateForm } from "@/components/saved-recipe-edit-form";
import { Section } from "@/components/section";
import { canManagePlans, requireFamilyContext } from "@/lib/family";

export const dynamic = "force-dynamic";

export default async function NewRecipePage() {
  const context = await requireFamilyContext("/recipes/new");
  const canManage = canManagePlans(context.role);

  return (
    <AppShell family={context.family} role={context.role} user={context.user}>
      <div className="ka-page">
        <PageIntro
          actions={
            <Link className="ka-button-secondary gap-2" href="/recipes">
              <ArrowLeft size={16} />
              Recipes
            </Link>
          }
          eyebrow="Recipe library"
          title="New Recipe"
        >
          Add a household recipe manually with structured ingredients, tags, and
          planning flags.
        </PageIntro>

        <Section title={canManage ? "Recipe Details" : "Owner/Admin Only"}>
          {canManage ? (
            <SavedRecipeCreateForm />
          ) : (
            <p className="text-sm font-semibold leading-6 text-[var(--muted-ink)]">
              Ask a family owner or admin to add recipes to the household cookbook.
            </p>
          )}
        </Section>
      </div>
    </AppShell>
  );
}
