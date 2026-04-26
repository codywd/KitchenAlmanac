import { AppShell } from "@/components/app-shell";
import { PageIntro } from "@/components/page-intro";
import { PasswordChangeForm } from "@/components/password-change-form";
import { Section } from "@/components/section";
import { requireFamilyContext } from "@/lib/family";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const context = await requireFamilyContext("/account");

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
      </div>
    </AppShell>
  );
}
