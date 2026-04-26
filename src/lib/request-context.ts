import { headers } from "next/headers";

import { createRequestId, hashValue, type RequestMetadata } from "./security";

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || undefined;
}

export async function getActionRequestMetadata(): Promise<RequestMetadata> {
  let headerStore: Awaited<ReturnType<typeof headers>>;

  try {
    headerStore = await headers();
  } catch {
    return {
      requestId: createRequestId(),
    };
  }

  const requestId =
    headerStore.get("x-vercel-id") ??
    headerStore.get("x-request-id") ??
    createRequestId();
  const ip =
    firstHeaderValue(headerStore.get("x-forwarded-for")) ??
    headerStore.get("x-real-ip") ??
    "unknown";
  const userAgent = headerStore.get("user-agent") ?? undefined;

  return {
    ipHash: ip === "unknown" ? undefined : hashValue(ip),
    requestId,
    userAgent,
  };
}
