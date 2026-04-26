import { createHash, randomUUID } from "node:crypto";

export const defaultJsonBodyLimitBytes = 256 * 1024;

export class RequestSecurityError extends Error {
  code: string;
  publicMessage: string;
  retryAfterSeconds?: number;
  status: number;

  constructor({
    code,
    message,
    publicMessage,
    retryAfterSeconds,
    status,
  }: {
    code: string;
    message?: string;
    publicMessage: string;
    retryAfterSeconds?: number;
    status: number;
  }) {
    super(message ?? publicMessage);
    this.code = code;
    this.publicMessage = publicMessage;
    this.retryAfterSeconds = retryAfterSeconds;
    this.status = status;
  }
}

export type RequestMetadata = {
  ipHash?: string;
  requestId: string;
  userAgent?: string;
};

const sensitiveKeyPattern = /api.?key|authorization|cookie|password|secret|session|token/i;

export function createRequestId() {
  return randomUUID();
}

export function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() || undefined;
}

export function getRequestMetadata(request: Request): RequestMetadata {
  const requestId =
    request.headers.get("x-vercel-id") ??
    request.headers.get("x-request-id") ??
    createRequestId();
  const ip =
    firstHeaderValue(request.headers.get("x-forwarded-for")) ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = request.headers.get("user-agent") ?? undefined;

  return {
    ipHash: ip === "unknown" ? undefined : hashValue(ip),
    requestId,
    userAgent,
  };
}

export function hasApiKeyCredential(request: Request) {
  return (
    /^Bearer\s+.+$/i.test(request.headers.get("authorization") ?? "") ||
    Boolean(request.headers.get("x-api-key"))
  );
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");

  if (!origin) {
    return true;
  }

  const requestUrl = new URL(request.url);

  if (origin === requestUrl.origin) {
    return true;
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (!host) {
    return false;
  }

  const protocol = forwardedProto ?? requestUrl.protocol.replace(":", "");

  return origin === `${protocol}://${host}`;
}

export function assertSameOriginMutation(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) {
    return;
  }

  if (hasApiKeyCredential(request)) {
    return;
  }

  if (!isSameOriginRequest(request)) {
    throw new RequestSecurityError({
      code: "invalid_origin",
      publicMessage: "Invalid request origin.",
      status: 403,
    });
  }
}

export async function readTextWithLimit(
  request: Request,
  limitBytes = defaultJsonBodyLimitBytes,
) {
  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (Number.isFinite(contentLength) && contentLength > limitBytes) {
    throw new RequestSecurityError({
      code: "body_too_large",
      publicMessage: "Request body is too large.",
      status: 413,
    });
  }

  const text = await request.text();

  if (Buffer.byteLength(text, "utf8") > limitBytes) {
    throw new RequestSecurityError({
      code: "body_too_large",
      publicMessage: "Request body is too large.",
      status: 413,
    });
  }

  return text;
}

export async function readJsonWithLimit(
  request: Request,
  limitBytes = defaultJsonBodyLimitBytes,
) {
  return JSON.parse(await readTextWithLimit(request, limitBytes));
}

export function sanitizeMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeMetadata(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      sensitiveKeyPattern.test(key) ? "[redacted]" : sanitizeMetadata(entry),
    ]),
  );
}
