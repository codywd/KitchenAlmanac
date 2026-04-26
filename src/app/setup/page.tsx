import {
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Sparkles,
} from "lucide-react";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { PageIntro } from "@/components/page-intro";
import { Section } from "@/components/section";
import { canManageFamily, requireFamilyContext } from "@/lib/family";
import { loadSetupStatus, type SetupStep } from "@/lib/setup";

export const dynamic = "force-dynamic";

function StepCard({ step }: { step: SetupStep }) {
  const Icon = step.complete ? CheckCircle2 : CircleDashed;
  const tone = step.complete ? undefined : step.required ? "warm" : "muted";

  return (
    <div className="ka-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="ka-status-mark" data-tone={tone}>
              {step.complete ? "Complete" : step.required ? "Next" : "Later"}
            </span>
            {step.required ? (
              <span className="text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
                Required
              </span>
            ) : null}
          </div>
          <h3 className="mt-4 text-lg font-black leading-6 text-[var(--ink)]">
            {step.title}
          </h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-[var(--muted-ink)]">
            {step.detail}
          </p>
        </div>
        <Icon
          className={step.complete ? "text-[var(--herb)]" : "text-[var(--brass)]"}
          size={22}
        />
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-extrabold text-[var(--ink)]">
          {step.metric}
        </span>
        {step.href && step.actionLabel ? (
          <Link className="ka-button-secondary gap-2" href={step.href}>
            {step.actionLabel}
            <ArrowRight size={15} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default async function SetupPage() {
  const context = await requireFamilyContext("/setup");
  const canManage = canManageFamily(context.role);
  const setupStatus = await loadSetupStatus({
    canManage,
    familyId: context.family.id,
  });
  const requiredSteps = setupStatus.steps.filter((step) => step.required);
  const optionalSteps = setupStatus.steps.filter((step) => !step.required);

  return (
    <AppShell family={context.family} role={context.role} user={context.user}>
      <div className="ka-page">
        <PageIntro
          actions={
            <>
              <Link className="ka-button-secondary gap-2" href="/calendar">
                Calendar
                <ArrowRight size={16} />
              </Link>
              {canManage ? (
                <Link className="ka-button gap-2" href="/planner">
                  Planner
                  <Sparkles size={16} />
                </Link>
              ) : null}
            </>
          }
          eyebrow="First-run readiness"
          title="KitchenAlmanac setup"
        >
          Owners and admins can use this checklist to get a production household
          ready without seeding sample users or default credentials.
        </PageIntro>

        <Section
          description={`${setupStatus.completedRequiredCount}/${setupStatus.requiredCount} required launch checks complete.`}
          title={setupStatus.isLaunchReady ? "Ready For Planning" : "Launch Checks"}
        >
          <div
            className={setupStatus.isLaunchReady ? "ka-success text-sm font-semibold leading-6" : "ka-note text-sm font-semibold leading-6"}
          >
            {setupStatus.isLaunchReady
              ? "The required setup checks are complete. Keep building the household loop with members, pantry staples, closeout, and saved recipes."
              : "Finish the remaining required checks before relying on the production workflow for weekly planning."}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {requiredSteps.map((step) => (
              <StepCard key={step.key} step={step} />
            ))}
          </div>
        </Section>

        <Section
          description="These are not required for the first plan, but they make KitchenAlmanac more useful after a week or two."
          title="Household Polish"
        >
          <div className="grid gap-4 md:grid-cols-3">
            {optionalSteps.map((step) => (
              <StepCard key={step.key} step={step} />
            ))}
          </div>
        </Section>

        {!canManage ? (
          <Section title="Read Only">
            <p className="text-sm font-semibold leading-6 text-[var(--muted-ink)]">
              Family members can view setup progress. Owners and admins manage
              family membership, guidance, API keys, and imports.
            </p>
          </Section>
        ) : null}
      </div>
    </AppShell>
  );
}
