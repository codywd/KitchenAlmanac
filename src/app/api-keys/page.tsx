import { revokeApiKeyAction } from "@/app/meal-actions";
import { ApiKeyManager } from "@/components/api-key-manager";
import { AppShell } from "@/components/app-shell";
import { PageIntro } from "@/components/page-intro";
import { Section } from "@/components/section";
import { describeApiKeyExpiry } from "@/lib/api-key-security";
import { getDb } from "@/lib/db";
import { canManageApiKeys, requireFamilyContext } from "@/lib/family";

export const dynamic = "force-dynamic";

export default async function ApiKeysPage() {
  const context = await requireFamilyContext("/api-keys");
  const canManage = canManageApiKeys(context.role);
  const apiKeys = await getDb().apiKey.findMany({
    include: {
      createdBy: {
        select: {
          email: true,
          name: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    where: {
      familyId: context.family.id,
    },
  });

  return (
    <AppShell family={context.family} role={context.role} user={context.user}>
      <div className="ka-page">
      <PageIntro eyebrow="External access" title="API keys">
          Use these keys with `Authorization: Bearer` or `X-API-Key` for outside
          LLM calls. Raw keys are shown once and stored only as hashes.
      </PageIntro>

      {canManage ? (
        <Section title="Create API Key">
          <ApiKeyManager />
        </Section>
      ) : null}

      <Section title="Existing Keys">
        <div className="ka-panel divide-y divide-[var(--line)]">
          {apiKeys.map((key) => (
            <div
              className="flex flex-col justify-between gap-3 py-4 first:pt-0 last:pb-0 md:flex-row md:items-center"
              key={key.id}
            >
              <div>
                <div className="text-lg font-black text-[var(--ink)]">{key.name}</div>
                <div className="mt-1 text-xs font-semibold text-[var(--muted-ink)]">
                  Prefix {key.keyPrefix} · Created {key.createdAt.toISOString().slice(0, 10)}
                  {key.createdBy
                    ? ` by ${key.createdBy.name ?? key.createdBy.email}`
                    : ""}
                  {key.lastUsedAt
                    ? ` · Last used ${key.lastUsedAt.toISOString().slice(0, 10)}`
                    : ""}
                  {` · ${describeApiKeyExpiry(key.expiresAt)}`}
                </div>
              </div>
              {key.revokedAt ? (
                <span className="ka-status-mark" data-tone="muted">
                  Revoked
                </span>
              ) : canManage ? (
                <form action={revokeApiKeyAction}>
                  <input name="id" type="hidden" value={key.id} />
                  <button className="ka-button-danger">
                    Revoke
                  </button>
                </form>
              ) : (
                <span className="ka-status-mark" data-tone="muted">
                  Active
                </span>
              )}
            </div>
          ))}
          {apiKeys.length === 0 ? (
            <p className="text-sm text-[var(--muted-ink)]">No API keys created yet.</p>
          ) : null}
        </div>
      </Section>
      </div>
    </AppShell>
  );
}
