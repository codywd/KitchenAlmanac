import { hashApiKey } from "./auth";
import { getDb } from "./db";
import {
  canManageApiKeys,
  getFamilyContextForUser,
  type FamilyContext,
} from "./family";
import { getCurrentUser, type CurrentUser } from "./session";
import { recordAuditEvent } from "./audit";
import { assertRateLimit, rateLimitPolicies } from "./rate-limit";
import { getRequestMetadata } from "./security";

export type AuthenticatedRequest = {
  authType: "apiKey" | "session";
  actorUserId?: string;
  family: FamilyContext["family"];
  role: FamilyContext["role"];
  user: CurrentUser | null;
};

export function getAuthenticatedActorUserId(auth: AuthenticatedRequest) {
  return auth.actorUserId ?? auth.user?.id ?? null;
}

function extractApiKey(request: Request) {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

  return bearer ?? request.headers.get("x-api-key");
}

export async function authenticateRequest(
  request: Request,
): Promise<AuthenticatedRequest | null> {
  const apiKey = extractApiKey(request);

  if (apiKey) {
    const keyHash = hashApiKey(apiKey);
    const requestMeta = getRequestMetadata(request);

    await assertRateLimit({
      policy: rateLimitPolicies.apiKey,
      requestMeta,
      scope: "api-key",
      subject: keyHash,
    });

    const key = await getDb().apiKey.findFirst({
      include: {
        createdBy: {
          select: {
            email: true,
            familyMembership: {
              select: {
                familyId: true,
                role: true,
              },
            },
            id: true,
            mustChangePassword: true,
            name: true,
          },
        },
        family: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      where: {
        keyHash,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });

    if (!key) {
      await assertRateLimit({
        policy: rateLimitPolicies.apiAuthFailure,
        requestMeta,
        scope: "api-auth-failure",
        subject: requestMeta.ipHash ?? "unknown",
      });
      await recordAuditEvent({
        metadata: {
          keyHashPrefix: keyHash.slice(0, 12),
        },
        outcome: "failure",
        requestMeta,
        type: "api_key.auth",
      });
      return null;
    }

    const creatorMembership = key.createdBy?.familyMembership;

    if (
      !key.createdByUserId ||
      !key.createdBy ||
      !creatorMembership ||
      creatorMembership.familyId !== key.familyId ||
      !canManageApiKeys(creatorMembership.role)
    ) {
      await recordAuditEvent({
        actorUserId: key.createdByUserId,
        familyId: key.familyId,
        outcome: "failure",
        requestMeta,
        subjectId: key.id,
        subjectType: "api-key",
        type: "api_key.auth",
      });
      return null;
    }

    await getDb().apiKey.update({
      data: {
        lastUsedAt: new Date(),
      },
      where: {
        id: key.id,
      },
    });
    await recordAuditEvent({
      actorUserId: key.createdByUserId,
      familyId: key.familyId,
      outcome: "success",
      requestMeta,
      subjectId: key.id,
      subjectType: "api-key",
      type: "api_key.auth",
    });

    return {
      actorUserId: key.createdByUserId ?? undefined,
      authType: "apiKey",
      family: key.family,
      role: "ADMIN",
      user: key.createdBy,
    };
  }

  const user = await getCurrentUser();

  if (!user) {
    return null;
  }

  const familyContext = await getFamilyContextForUser(user);

  return {
    actorUserId: user.id,
    authType: "session",
    family: familyContext.family,
    role: familyContext.role,
    user,
  };
}
