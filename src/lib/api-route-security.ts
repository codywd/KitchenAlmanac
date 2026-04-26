import type { AuthenticatedRequest } from "./api-auth";
import { requestSecurityError } from "./http";
import { assertRateLimit, type RateLimitPolicy } from "./rate-limit";
import {
  assertSameOriginMutation,
  getRequestMetadata,
  readJsonWithLimit,
  readTextWithLimit,
  RequestSecurityError,
} from "./security";

export async function secureMutationRequest({
  auth,
  rateLimit,
  request,
}: {
  auth: AuthenticatedRequest;
  rateLimit?: {
    policy: RateLimitPolicy;
    scope: string;
    subject: string;
  };
  request: Request;
}) {
  try {
    assertSameOriginMutation(request);

    if (rateLimit) {
      await assertRateLimit({
        actorUserId: auth.actorUserId ?? auth.user?.id,
        familyId: auth.family.id,
        policy: rateLimit.policy,
        requestMeta: getRequestMetadata(request),
        scope: rateLimit.scope,
        subject: rateLimit.subject,
      });
    }

    return null;
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return requestSecurityError(error);
    }

    throw error;
  }
}

export { readJsonWithLimit, readTextWithLimit };
