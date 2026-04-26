import { recordAuditEvent } from "./audit";
import { getDb } from "./db";
import { hashValue, RequestSecurityError, type RequestMetadata } from "./security";

export type RateLimitPolicy = {
  blockMs?: number;
  limit: number;
  windowMs: number;
};

export const rateLimitPolicies = {
  apiAuthFailure: { blockMs: 15 * 60 * 1000, limit: 20, windowMs: 15 * 60 * 1000 },
  apiKey: { blockMs: 60 * 1000, limit: 120, windowMs: 60 * 1000 },
  importPlan: { blockMs: 10 * 60 * 1000, limit: 10, windowMs: 10 * 60 * 1000 },
  login: { blockMs: 15 * 60 * 1000, limit: 5, windowMs: 15 * 60 * 1000 },
  planningWrite: { blockMs: 10 * 60 * 1000, limit: 20, windowMs: 10 * 60 * 1000 },
  shoppingWrite: { blockMs: 60 * 1000, limit: 120, windowMs: 60 * 1000 },
} satisfies Record<string, RateLimitPolicy>;

export type RateLimitBucketState = {
  blockedUntil?: Date | null;
  count: number;
  windowExpiresAt: Date;
};

export type RateLimitDecision =
  | {
      allowed: true;
      blockedUntil?: Date | null;
      count: number;
      retryAfterSeconds?: undefined;
      windowExpiresAt: Date;
      windowStart: Date;
    }
  | {
      allowed: false;
      blockedUntil: Date;
      count: number;
      retryAfterSeconds: number;
      windowExpiresAt: Date;
      windowStart: Date;
    };

function secondsUntil(date: Date, now: Date) {
  return Math.max(1, Math.ceil((date.getTime() - now.getTime()) / 1000));
}

export function evaluateRateLimitBucket({
  existing,
  now,
  policy,
}: {
  existing?: RateLimitBucketState | null;
  now: Date;
  policy: RateLimitPolicy;
}): RateLimitDecision {
  if (existing?.blockedUntil && existing.blockedUntil > now) {
    return {
      allowed: false,
      blockedUntil: existing.blockedUntil,
      count: existing.count,
      retryAfterSeconds: secondsUntil(existing.blockedUntil, now),
      windowExpiresAt: existing.windowExpiresAt,
      windowStart: new Date(
        existing.windowExpiresAt.getTime() - policy.windowMs,
      ),
    };
  }

  if (!existing || existing.windowExpiresAt <= now) {
    return {
      allowed: true,
      blockedUntil: null,
      count: 1,
      windowExpiresAt: new Date(now.getTime() + policy.windowMs),
      windowStart: now,
    };
  }

  const count = existing.count + 1;

  if (count > policy.limit) {
    const blockedUntil = new Date(
      now.getTime() + (policy.blockMs ?? policy.windowMs),
    );

    return {
      allowed: false,
      blockedUntil,
      count,
      retryAfterSeconds: secondsUntil(blockedUntil, now),
      windowExpiresAt: existing.windowExpiresAt,
      windowStart: new Date(
        existing.windowExpiresAt.getTime() - policy.windowMs,
      ),
    };
  }

  return {
    allowed: true,
    blockedUntil: null,
    count,
    windowExpiresAt: existing.windowExpiresAt,
    windowStart: new Date(existing.windowExpiresAt.getTime() - policy.windowMs),
  };
}

export async function assertRateLimit({
  actorUserId,
  familyId,
  policy,
  requestMeta,
  scope,
  subject,
}: {
  actorUserId?: string | null;
  familyId?: string | null;
  policy: RateLimitPolicy;
  requestMeta?: RequestMetadata;
  scope: string;
  subject: string;
}) {
  const subjectHash = hashValue(subject);
  const key = `${scope}:${subjectHash}`;
  const now = new Date();
  const db = getDb();

  if (!("rateLimitBucket" in db)) {
    return;
  }

  const existing = await db.rateLimitBucket.findUnique({
    where: {
      key,
    },
  });
  const decision = evaluateRateLimitBucket({
    existing,
    now,
    policy,
  });

  await db.rateLimitBucket.upsert({
    create: {
      blockedUntil: decision.blockedUntil ?? null,
      count: decision.count,
      key,
      scope,
      subject: subjectHash,
      windowExpiresAt: decision.windowExpiresAt,
      windowStart: decision.windowStart,
    },
    update: {
      blockedUntil: decision.blockedUntil ?? null,
      count: decision.count,
      windowExpiresAt: decision.windowExpiresAt,
      windowStart: decision.windowStart,
    },
    where: {
      key,
    },
  });

  if (!decision.allowed) {
    await recordAuditEvent({
      actorUserId,
      familyId,
      metadata: {
        retryAfterSeconds: decision.retryAfterSeconds,
        scope,
      },
      outcome: "failure",
      requestMeta,
      subjectId: subjectHash.slice(0, 16),
      subjectType: "rate-limit-subject",
      type: "rate_limit.lockout",
    });

    throw new RequestSecurityError({
      code: "rate_limited",
      publicMessage: "Too many requests. Try again shortly.",
      retryAfterSeconds: decision.retryAfterSeconds,
      status: 429,
    });
  }
}
