import { hashApiKey } from "./auth";
import { getDb } from "./db";
import { getFamilyContextForUser, type FamilyContext } from "./family";
import { getCurrentUser, type CurrentUser } from "./session";

export type AuthenticatedRequest = {
  authType: "apiKey" | "session";
  actorUserId?: string;
  family: FamilyContext["family"];
  role: FamilyContext["role"];
  user: CurrentUser | null;
};

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
    const key = await getDb().apiKey.findFirst({
      include: {
        createdBy: {
          select: {
            email: true,
            id: true,
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
