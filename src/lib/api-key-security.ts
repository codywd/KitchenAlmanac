export const apiKeyExpiryChoices = [30, 90, 180] as const;

export type ApiKeyExpiryChoice = (typeof apiKeyExpiryChoices)[number];

export function createApiKeyExpiryDate(
  days: ApiKeyExpiryChoice,
  now = new Date(),
) {
  const expiresAt = new Date(now);

  expiresAt.setDate(expiresAt.getDate() + days);

  return expiresAt;
}

export function describeApiKeyExpiry(expiresAt: Date | null, now = new Date()) {
  if (!expiresAt) {
    return "Legacy key: no expiry, rotate soon";
  }

  if (expiresAt <= now) {
    return `Expired ${expiresAt.toISOString().slice(0, 10)}`;
  }

  return `Expires ${expiresAt.toISOString().slice(0, 10)}`;
}

export function needsApiKeyRotation({
  expiresAt,
  revokedAt,
}: {
  expiresAt: Date | null;
  revokedAt?: Date | null;
}) {
  return !revokedAt && !expiresAt;
}
