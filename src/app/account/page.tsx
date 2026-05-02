import { AppShell } from "@/components/app-shell";
import { LlmSettingsForm } from "@/components/llm-settings-form";
import { PageIntro } from "@/components/page-intro";
import { PasswordChangeForm } from "@/components/password-change-form";
import { Section } from "@/components/section";
import { requireFamilyContext } from "@/lib/family";
import { getUserLlmSettingsForDisplay } from "@/lib/llm-settings";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const context = await requireFamilyContext("/account");
  const llmSettings = await getUserLlmSettingsForDisplay(context.user.id);

  return (
    <AppShell family={context.family} role={context.role} user={context.user}>
      <div className="ka-page">
        <PageIntro eyebrow="Your login" title="Account">
          Update the password you use to access KitchenAlmanac. If
          someone added you with a temporary password, change it here after your
          first sign-in.
        </PageIntro>

        {context.user.mustChangePassword ? (
          <div className="ka-alert mb-6">
            <div className="text-sm font-black text-[var(--ink)]">
              Password change required
            </div>
            <p className="mt-1 text-sm font-semibold text-[var(--muted-ink)]">
              Update your temporary password before continuing to the rest of the app.
            </p>
          </div>
        ) : null}

        <Section
          description={`${context.user.email} / ${context.family.name} / ${context.role.toLowerCase()}`}
          title="Password"
        >
          <PasswordChangeForm />
        </Section>

        <Section
          description="Stored per user; not shared with the household."
          title="LLM Provider"
        >
          <LlmSettingsForm settings={llmSettings} />
        </Section>
      </div>
    </AppShell>
  );
}
