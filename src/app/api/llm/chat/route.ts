import { authenticateRequest } from "@/lib/api-auth";
import { badRequest, forbidden, json, notFound, unauthorized } from "@/lib/http";
import { getUserLlmProviderConfig, markUserLlmSettingsUsed } from "@/lib/llm-settings";
import { sendLlmChat, type LlmChatMessage } from "@/lib/llm-provider";
import { assertRateLimit, rateLimitPolicies } from "@/lib/rate-limit";
import {
  buildRecipeChatSystemPrompt,
  loadRecipeChatContext,
} from "@/lib/recipe-chat-context";
import {
  assertSameOriginMutation,
  getRequestMetadata,
  readJsonWithLimit,
  RequestSecurityError,
} from "@/lib/security";
import { requestSecurityError } from "@/lib/http";

export const dynamic = "force-dynamic";

function parseMessages(value: unknown): LlmChatMessage[] {
  if (!Array.isArray(value)) {
    throw new Error("Send at least one chat message.");
  }

  const messages = value
    .map((message) => {
      if (!message || typeof message !== "object") {
        return null;
      }

      const record = message as { content?: unknown; role?: unknown };
      const content = typeof record.content === "string" ? record.content.trim() : "";
      const role = record.role;

      if (!content || (role !== "assistant" && role !== "user")) {
        return null;
      }

      return {
        content: content.slice(0, 2_000),
        role,
      };
    })
    .filter((message): message is LlmChatMessage => Boolean(message))
    .slice(-12);

  if (!messages.length || messages.at(-1)?.role !== "user") {
    throw new Error("Send a user question before asking the recipe assistant.");
  }

  return messages;
}

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);

  if (!auth) {
    return unauthorized();
  }

  if (auth.authType !== "session" || !auth.user) {
    return forbidden("Recipe chat requires a signed-in user session.");
  }

  const requestMeta = getRequestMetadata(request);

  try {
    assertSameOriginMutation(request);
    await assertRateLimit({
      actorUserId: auth.user.id,
      familyId: auth.family.id,
      policy: rateLimitPolicies.llmChat,
      requestMeta,
      scope: "llm-chat",
      subject: `${auth.family.id}:${auth.user.id}`,
    });

    const body = (await readJsonWithLimit(request, 32 * 1024)) as {
      mealId?: unknown;
      messages?: unknown;
    };
    const mealId = typeof body.mealId === "string" ? body.mealId.trim() : "";
    const messages = parseMessages(body.messages);

    if (!mealId) {
      return badRequest(new Error("Meal not found."));
    }

    const config = await getUserLlmProviderConfig(auth.user.id);

    if (!config) {
      return badRequest(new Error("Add an LLM provider in Account before using recipe chat."));
    }

    const context = await loadRecipeChatContext({
      familyId: auth.family.id,
      mealId,
    });

    if (!context) {
      return notFound("Meal not found.");
    }

    const reply = await sendLlmChat({
      ...config,
      messages,
      systemPrompt: buildRecipeChatSystemPrompt(context),
    });

    await markUserLlmSettingsUsed(auth.user.id);

    return json({ reply: reply.text });
  } catch (error) {
    if (error instanceof RequestSecurityError) {
      return requestSecurityError(error);
    }

    return badRequest(error);
  }
}
