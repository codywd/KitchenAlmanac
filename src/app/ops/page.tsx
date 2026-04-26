import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PageIntro } from "@/components/page-intro";
import { Section } from "@/components/section";
import { getDb } from "@/lib/db";
import { canManageFamily, requireFamilyContext } from "@/lib/family";
import { getHealthStatus } from "@/lib/ops";

export const dynamic = "force-dynamic";

function formatDate(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 16).replace("T", " ") : "Never";
}

export default async function OpsPage() {
  const context = await requireFamilyContext("/ops");

  if (!canManageFamily(context.role)) {
    notFound();
  }

  const now = new Date();
  const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const db = getDb();
  const [health, recentAuditEvents, watchedApiKeys, authFailures, lastMaintenance] =
    await Promise.all([
      getHealthStatus(),
      db.auditEvent.findMany({
        include: {
          actor: {
            select: {
              email: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 12,
        where: {
          familyId: context.family.id,
        },
      }),
      db.apiKey.findMany({
        orderBy: {
          createdAt: "desc",
        },
        where: {
          familyId: context.family.id,
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { lte: soon } }],
        },
      }),
      db.auditEvent.count({
        where: {
          createdAt: {
            gte: new Date(now.getTime() - 24 * 60 * 60 * 1000),
          },
          familyId: context.family.id,
          outcome: "failure",
          type: {
            in: ["auth.login", "api_key.auth", "rate_limit.lockout"],
          },
        },
      }),
      db.auditEvent.findFirst({
        orderBy: {
          createdAt: "desc",
        },
        where: {
          type: "ops.maintenance",
        },
      }),
    ]);

  return (
    <AppShell family={context.family} role={context.role} user={context.user}>
      <div className="ka-page">
        <PageIntro eyebrow="Operations" title="Security and ops">
          Production health, audit signals, and keys that need attention.
        </PageIntro>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="ka-panel">
            <div className="ka-kicker">Database</div>
            <div className="mt-2 text-2xl font-black text-[var(--ink)]">
              {health.database === "ok" ? "Healthy" : "Check logs"}
            </div>
            <p className="mt-2 text-sm font-semibold text-[var(--muted-ink)]">
              Checked {health.checkedAt.slice(0, 16).replace("T", " ")}
            </p>
          </div>
          <div className="ka-panel">
            <div className="ka-kicker">Auth failures</div>
            <div className="mt-2 text-2xl font-black text-[var(--ink)]">
              {authFailures}
            </div>
            <p className="mt-2 text-sm font-semibold text-[var(--muted-ink)]">
              Login, API key, and rate-limit failures in the last 24 hours.
            </p>
          </div>
          <div className="ka-panel">
            <div className="ka-kicker">Maintenance</div>
            <div className="mt-2 text-2xl font-black text-[var(--ink)]">
              {formatDate(lastMaintenance?.createdAt)}
            </div>
            <p className="mt-2 text-sm font-semibold text-[var(--muted-ink)]">
              Daily cleanup keeps expired sessions and stale rate buckets small.
            </p>
          </div>
        </div>

        <Section title="API Keys To Rotate">
          <div className="ka-panel divide-y divide-[var(--line)]">
            {watchedApiKeys.map((key) => (
              <div className="py-3 first:pt-0 last:pb-0" key={key.id}>
                <div className="text-sm font-black text-[var(--ink)]">
                  {key.name}
                </div>
                <p className="mt-1 text-xs font-semibold text-[var(--muted-ink)]">
                  Prefix {key.keyPrefix} /{" "}
                  {key.expiresAt
                    ? `expires ${key.expiresAt.toISOString().slice(0, 10)}`
                    : "legacy key without expiry"}
                </p>
              </div>
            ))}
            {watchedApiKeys.length === 0 ? (
              <p className="text-sm text-[var(--muted-ink)]">
                No active keys are expired, expiring soon, or missing expiry.
              </p>
            ) : null}
          </div>
        </Section>

        <Section title="Recent Audit Events">
          <div className="ka-panel divide-y divide-[var(--line)]">
            {recentAuditEvents.map((event) => (
              <div className="py-3 first:pt-0 last:pb-0" key={event.id}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-sm font-black text-[var(--ink)]">
                    {event.type} / {event.outcome}
                  </div>
                  <div className="text-xs font-semibold text-[var(--muted-ink)]">
                    {formatDate(event.createdAt)}
                  </div>
                </div>
                <p className="mt-1 text-xs font-semibold text-[var(--muted-ink)]">
                  {event.actor?.name ?? event.actor?.email ?? "System"}
                  {event.subjectType ? ` / ${event.subjectType}` : ""}
                </p>
              </div>
            ))}
            {recentAuditEvents.length === 0 ? (
              <p className="text-sm text-[var(--muted-ink)]">
                No audit events recorded for this family yet.
              </p>
            ) : null}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
