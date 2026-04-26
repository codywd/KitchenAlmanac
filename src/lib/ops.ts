import type { Prisma } from "@prisma/client";

import { recordAuditEvent } from "./audit";
import { getDb } from "./db";

export type HealthStatus = {
  app: "ok";
  checkedAt: string;
  database: "error" | "ok";
  deployment?: {
    commit?: string;
    environment?: string;
    id?: string;
    url?: string;
  };
};

export async function getHealthStatus(): Promise<HealthStatus> {
  const checkedAt = new Date().toISOString();

  try {
    await getDb().$queryRaw`SELECT 1`;

    return {
      app: "ok",
      checkedAt,
      database: "ok",
      deployment: {
        commit: process.env.VERCEL_GIT_COMMIT_SHA,
        environment: process.env.VERCEL_ENV,
        id: process.env.VERCEL_DEPLOYMENT_ID,
        url: process.env.VERCEL_URL,
      },
    };
  } catch {
    return {
      app: "ok",
      checkedAt,
      database: "error",
      deployment: {
        commit: process.env.VERCEL_GIT_COMMIT_SHA,
        environment: process.env.VERCEL_ENV,
        id: process.env.VERCEL_DEPLOYMENT_ID,
        url: process.env.VERCEL_URL,
      },
    };
  }
}

export async function runOpsMaintenance() {
  const now = new Date();
  const auditRetention = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  const bucketRetention = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const db = getDb();

  const [expiredSessions, expiredBuckets, oldAuditEvents] = await db.$transaction([
    db.session.deleteMany({
      where: {
        expiresAt: {
          lt: now,
        },
      },
    }),
    db.rateLimitBucket.deleteMany({
      where: {
        blockedUntil: null,
        windowExpiresAt: {
          lt: bucketRetention,
        },
      },
    }),
    db.auditEvent.deleteMany({
      where: {
        createdAt: {
          lt: auditRetention,
        },
        type: {
          not: "ops.maintenance",
        },
      },
    }),
  ]);

  const result = {
    expiredRateLimitBuckets: expiredBuckets.count,
    expiredSessions: expiredSessions.count,
    oldAuditEvents: oldAuditEvents.count,
  };

  await recordAuditEvent({
    metadata: result as Prisma.JsonObject,
    outcome: "success",
    type: "ops.maintenance",
  });

  return result;
}
