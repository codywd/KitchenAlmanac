import type { Prisma } from "@prisma/client";

import { getDb } from "./db";
import {
  getRequestMetadata,
  sanitizeMetadata,
  type RequestMetadata,
} from "./security";

export type AuditOutcome = "failure" | "success";

export type AuditEventInput = {
  actorUserId?: string | null;
  familyId?: string | null;
  message?: string;
  metadata?: Record<string, unknown>;
  outcome: AuditOutcome;
  request?: Request;
  requestMeta?: RequestMetadata;
  subjectId?: string | null;
  subjectType?: string | null;
  type: string;
};

function toJsonMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) {
    return undefined;
  }

  return sanitizeMetadata(metadata) as Prisma.InputJsonValue;
}

export function writeStructuredLog(
  level: "error" | "info" | "warn",
  message: string,
  fields: Record<string, unknown> = {},
) {
  const payload = sanitizeMetadata({
    level,
    message,
    ...fields,
  });
  const line = JSON.stringify(payload);

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export async function recordAuditEvent(input: AuditEventInput) {
  const requestMeta =
    input.requestMeta ?? (input.request ? getRequestMetadata(input.request) : null);
  const safeMetadata = toJsonMetadata(input.metadata);

  writeStructuredLog("info", "audit_event", {
    actorUserId: input.actorUserId,
    familyId: input.familyId,
    outcome: input.outcome,
    requestId: requestMeta?.requestId,
    subjectId: input.subjectId,
    subjectType: input.subjectType,
    type: input.type,
  });

  try {
    await getDb().auditEvent.create({
      data: {
        actorUserId: input.actorUserId ?? null,
        familyId: input.familyId ?? null,
        ipHash: requestMeta?.ipHash,
        message: input.message,
        metadata: safeMetadata,
        outcome: input.outcome,
        requestId: requestMeta?.requestId,
        subjectId: input.subjectId ?? null,
        subjectType: input.subjectType ?? null,
        type: input.type,
        userAgent: requestMeta?.userAgent,
      },
    });
  } catch (error) {
    writeStructuredLog("warn", "audit_event_write_failed", {
      error: error instanceof Error ? error.message : String(error),
      type: input.type,
    });
  }
}
