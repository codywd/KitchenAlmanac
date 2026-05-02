import { describe, expect, it, vi } from "vitest";

import {
  defaultLlmBaseUrl,
  listLlmModels,
  normalizeLlmBaseUrl,
  sendLlmChat,
} from "./llm-provider";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
    },
    status: 200,
    ...init,
  });
}

describe("LLM provider adapters", () => {
  it("lists OpenAI-compatible models with bearer auth", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        data: [
          { id: "gpt-5.5" },
          { id: "gpt-5.4-mini" },
        ],
      }),
    );

    const models = await listLlmModels({
      apiKey: "sk-openai",
      fetchImpl,
      providerKind: "OPENAI_COMPATIBLE",
    });

    expect(models).toEqual([
      { id: "gpt-5.5", name: "gpt-5.5" },
      { id: "gpt-5.4-mini", name: "gpt-5.4-mini" },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.openai.com/v1/models",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer sk-openai",
        }),
        method: "GET",
      }),
    );
  });

  it("lists Anthropic-compatible models with Anthropic headers", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        data: [
          {
            display_name: "Claude Sonnet",
            id: "claude-sonnet-4-5",
          },
        ],
      }),
    );

    const models = await listLlmModels({
      apiKey: "sk-ant",
      fetchImpl,
      providerKind: "ANTHROPIC_COMPATIBLE",
    });

    expect(models).toEqual([
      { id: "claude-sonnet-4-5", name: "Claude Sonnet" },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.anthropic.com/v1/models",
      expect.objectContaining({
        headers: expect.objectContaining({
          "anthropic-version": "2023-06-01",
          "x-api-key": "sk-ant",
        }),
        method: "GET",
      }),
    );
  });

  it("sends chat requests with the provider-specific wire shape", async () => {
    const openAiFetch = vi.fn(async () =>
      jsonResponse({
        choices: [{ message: { content: "Use a lower oven rack." } }],
      }),
    );
    const anthropicFetch = vi.fn(async () =>
      jsonResponse({
        content: [{ text: "Stir before serving.", type: "text" }],
      }),
    );

    await expect(
      sendLlmChat({
        apiKey: "sk-openai",
        fetchImpl: openAiFetch,
        messages: [{ content: "Can I prep this early?", role: "user" }],
        modelId: "gpt-5.4-mini",
        providerKind: "OPENAI_COMPATIBLE",
        systemPrompt: "Recipe context here",
      }),
    ).resolves.toEqual({ text: "Use a lower oven rack." });
    expect(JSON.parse(String(openAiFetch.mock.calls[0][1]?.body))).toMatchObject({
      messages: [
        { content: "Recipe context here", role: "system" },
        { content: "Can I prep this early?", role: "user" },
      ],
      model: "gpt-5.4-mini",
      store: false,
    });

    await expect(
      sendLlmChat({
        apiKey: "sk-ant",
        fetchImpl: anthropicFetch,
        messages: [{ content: "What can I substitute?", role: "user" }],
        modelId: "claude-sonnet-4-5",
        providerKind: "ANTHROPIC_COMPATIBLE",
        systemPrompt: "Recipe context here",
      }),
    ).resolves.toEqual({ text: "Stir before serving." });
    expect(JSON.parse(String(anthropicFetch.mock.calls[0][1]?.body))).toMatchObject({
      max_tokens: 800,
      messages: [{ content: "What can I substitute?", role: "user" }],
      model: "claude-sonnet-4-5",
      system: "Recipe context here",
    });
  });

  it("normalizes defaults and rejects unsafe base URLs", () => {
    expect(defaultLlmBaseUrl("OPENAI_COMPATIBLE")).toBe(
      "https://api.openai.com/v1",
    );
    expect(defaultLlmBaseUrl("ANTHROPIC_COMPATIBLE")).toBe(
      "https://api.anthropic.com/v1",
    );
    expect(
      normalizeLlmBaseUrl("http://localhost:4000/v1/", "OPENAI_COMPATIBLE", {
        nodeEnv: "development",
      }),
    ).toBe("http://localhost:4000/v1");
    expect(() =>
      normalizeLlmBaseUrl(
        "https://user:pass@example.com/v1",
        "OPENAI_COMPATIBLE",
      ),
    ).toThrow("credentials");
    expect(() =>
      normalizeLlmBaseUrl("http://api.example.com/v1", "OPENAI_COMPATIBLE", {
        nodeEnv: "production",
      }),
    ).toThrow("HTTPS");
  });
});
