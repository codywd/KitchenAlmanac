import { authenticateRequest } from "@/lib/api-auth";
import { badRequest, forbidden, json, unauthorized } from "@/lib/http";
import {
  getUserLlmProviderConfig,
  getUserLlmProviderMetadata,
} from "@/lib/llm-settings";
import {
  listLlmModels,
  llmProviderKinds,
  normalizeLlmBaseUrl,
  type LlmProviderKind,
} from "@/lib/llm-provider";
import { assertRateLimit, rateLimitPolicies } from "@/lib/rate-limit";
import {
  assertSameOriginMutation,
  getRequestMetadata,
  readJsonWithLimit,
  RequestSecurityError,
} from "@/lib/security";
import { requestSecurityError } from "@/lib/http";

export const dynamic = "force-dynamic";

function isLlmProviderKind(value: unknown): value is LlmProviderKind {
  return (
    typeof value === "string" &&
    llmProviderKinds.includes(value as LlmProviderKind)
  );
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  if (auth.authType !== "session" || !auth.user) {
    return forbidden("LLM provider settings require a signed-in user session.");
  }

  const requestMeta = getRequestMetadata(request);

  try {
    assertSameOriginMutation(request);
    await assertRateLimit({
      actorUserId: auth.user.id,
      familyId: auth.family.id,
      policy: rateLimitPolicies.llmModelList,
      requestMeta,
      scope: "llm-model-list",
      subject: `${auth.family.id}:${auth.user.id}`,
    });

    const body = (await readJsonWithLimit(request, 16 * 1024)) as {
      apiKey?: unknown;
      baseUrl?: unknown;
      providerKind?: unknown;
    };
    const submittedApiKey =
      typeof body.apiKey === "string" && body.apiKey.trim()
        ? body.apiKey.trim()
        : null;
    const submittedBaseUrl =
      typeof body.baseUrl === "string" && body.baseUrl.trim()
        ? body.baseUrl.trim()
        : null;
    const submittedProviderKind = isLlmProviderKind(body.providerKind)
      ? body.providerKind
      : null;
    const savedConfig = submittedApiKey
      ? null
      : await getUserLlmProviderConfig(auth.user.id);
    const savedMetadata =
      submittedApiKey && (!submittedProviderKind || !submittedBaseUrl)
        ? await getUserLlmProviderMetadata(auth.user.id)
        : null;
    const providerKind =
      submittedProviderKind ??
      savedConfig?.providerKind ??
      savedMetadata?.providerKind;

    if (!providerKind) {
      return badRequest(new Error("Choose an LLM provider first."));
    }

    const apiKey = submittedApiKey ?? savedConfig?.apiKey;

    if (!apiKey) {
      return badRequest(new Error("Enter an API key or save LLM settings first."));
    }

    const baseUrl = normalizeLlmBaseUrl(
      submittedBaseUrl ?? savedConfig?.baseUrl ?? savedMetadata?.baseUrl,
      providerKind,
    );
    const models = await listLlmModels({
      apiKey,
      baseUrl,
      providerKind,
    });

    return json({ models });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return requestSecurityError(error);
    }

    return badRequest(error);
  }
}
