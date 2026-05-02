export const llmProviderKinds = [
  "OPENAI_COMPATIBLE",
  "ANTHROPIC_COMPATIBLE",
] as const;

export type LlmProviderKind = (typeof llmProviderKinds)[number];

export type LlmModelOption = {
  id: string;
  name: string;
};

export type LlmChatMessage = {
  content: string;
  role: "assistant" | "user";
};

export type LlmProviderInput = {
  apiKey: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  providerKind: LlmProviderKind;
};

const anthropicVersion = "2023-06-01";
const requestTimeoutMs = 45_000;

function activeFetch(fetchImpl?: typeof fetch) {
  return fetchImpl ?? fetch;
}

export function defaultLlmBaseUrl(providerKind: LlmProviderKind) {
  return providerKind === "ANTHROPIC_COMPATIBLE"
    ? "https://api.anthropic.com/v1"
    : "https://api.openai.com/v1";
}

function isLocalHostname(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

export function normalizeLlmBaseUrl(
  value: string | null | undefined,
  providerKind: LlmProviderKind,
  {
    nodeEnv = process.env.NODE_ENV,
  }: {
    nodeEnv?: string;
  } = {},
) {
  const rawValue = value?.trim() || defaultLlmBaseUrl(providerKind);
  let url: URL;

  try {
    url = new URL(rawValue);
  } catch {
    throw new Error("Enter a valid provider base URL.");
  }

  if (url.username || url.password) {
    throw new Error("Provider base URL must not include credentials.");
  }

  if (url.search || url.hash) {
    throw new Error("Provider base URL must not include query strings or fragments.");
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Provider base URL must use HTTP or HTTPS.");
  }

  if (
    url.protocol !== "https:" &&
    (nodeEnv === "production" || !isLocalHostname(url.hostname))
  ) {
    throw new Error("Provider base URL must use HTTPS outside local development.");
  }

  return url.toString().replace(/\/$/u, "");
}

function joinProviderUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/u, "")}/${path.replace(/^\//u, "")}`;
}

function abortSignal() {
  if ("timeout" in AbortSignal) {
    return AbortSignal.timeout(requestTimeoutMs);
  }

  return undefined;
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  let body: unknown = null;

  if (text.trim()) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof (body as { error?: unknown }).error === "object"
        ? String(
            ((body as { error: { message?: unknown } }).error.message ??
              "Provider request failed."),
          )
        : `Provider request failed with status ${response.status}.`;

    throw new Error(message);
  }

  return body;
}

function modelName(value: Record<string, unknown>) {
  return (
    (typeof value.display_name === "string" && value.display_name.trim()) ||
    (typeof value.name === "string" && value.name.trim()) ||
    (typeof value.id === "string" && value.id.trim()) ||
    null
  );
}

function parseModels(body: unknown) {
  const data =
    body && typeof body === "object" && Array.isArray((body as { data?: unknown }).data)
      ? (body as { data: unknown[] }).data
      : [];

  return data
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const id = typeof record.id === "string" ? record.id.trim() : "";
      const name = modelName(record);

      return id && name ? { id, name } : null;
    })
    .filter((item): item is LlmModelOption => Boolean(item));
}

export async function listLlmModels(input: LlmProviderInput) {
  const baseUrl = normalizeLlmBaseUrl(input.baseUrl, input.providerKind);
  const response = await activeFetch(input.fetchImpl)(
    joinProviderUrl(baseUrl, "models"),
    {
      headers:
        input.providerKind === "ANTHROPIC_COMPATIBLE"
          ? {
              "anthropic-version": anthropicVersion,
              "x-api-key": input.apiKey,
            }
          : {
              Authorization: `Bearer ${input.apiKey}`,
            },
      method: "GET",
      signal: abortSignal(),
    },
  );

  return parseModels(await readJsonResponse(response));
}

function parseOpenAiChatText(body: unknown) {
  const choices =
    body &&
    typeof body === "object" &&
    Array.isArray((body as { choices?: unknown }).choices)
      ? (body as { choices: unknown[] }).choices
      : [];
  const first = choices[0];

  if (!first || typeof first !== "object") {
    return null;
  }

  const message = (first as { message?: unknown }).message;

  if (!message || typeof message !== "object") {
    return null;
  }

  const content = (message as { content?: unknown }).content;

  return typeof content === "string" && content.trim() ? content.trim() : null;
}

function parseAnthropicChatText(body: unknown) {
  const content =
    body &&
    typeof body === "object" &&
    Array.isArray((body as { content?: unknown }).content)
      ? (body as { content: unknown[] }).content
      : [];

  return content
    .map((part) =>
      part &&
      typeof part === "object" &&
      (part as { type?: unknown }).type === "text" &&
      typeof (part as { text?: unknown }).text === "string"
        ? (part as { text: string }).text
        : "",
    )
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function sendLlmChat({
  apiKey,
  baseUrl,
  fetchImpl,
  messages,
  modelId,
  providerKind,
  systemPrompt,
}: LlmProviderInput & {
  messages: LlmChatMessage[];
  modelId: string;
  systemPrompt: string;
}) {
  const normalizedBaseUrl = normalizeLlmBaseUrl(baseUrl, providerKind);
  const response =
    providerKind === "ANTHROPIC_COMPATIBLE"
      ? await activeFetch(fetchImpl)(joinProviderUrl(normalizedBaseUrl, "messages"), {
          body: JSON.stringify({
            max_tokens: 800,
            messages,
            model: modelId,
            system: systemPrompt,
          }),
          headers: {
            "anthropic-version": anthropicVersion,
            "content-type": "application/json",
            "x-api-key": apiKey,
          },
          method: "POST",
          signal: abortSignal(),
        })
      : await activeFetch(fetchImpl)(
          joinProviderUrl(normalizedBaseUrl, "chat/completions"),
          {
            body: JSON.stringify({
              max_tokens: 800,
              messages: [
                {
                  content: systemPrompt,
                  role: "system",
                },
                ...messages,
              ],
              model: modelId,
              store: false,
            }),
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "content-type": "application/json",
            },
            method: "POST",
            signal: abortSignal(),
          },
        );
  const body = await readJsonResponse(response);
  const text =
    providerKind === "ANTHROPIC_COMPATIBLE"
      ? parseAnthropicChatText(body)
      : parseOpenAiChatText(body);

  if (!text) {
    throw new Error("Provider response did not include assistant text.");
  }

  return { text };
}
