import { describe, expect, it } from "vitest";

import {
  assertSameOriginMutation,
  readJsonWithLimit,
  RequestSecurityError,
} from "./security";

describe("request security helpers", () => {
  it("allows same-origin browser mutations", () => {
    const request = new Request("https://meals.example/api/weeks", {
      headers: {
        origin: "https://meals.example",
      },
      method: "POST",
    });

    expect(() => assertSameOriginMutation(request)).not.toThrow();
  });

  it("rejects cross-origin browser mutations", () => {
    const request = new Request("https://meals.example/api/weeks", {
      headers: {
        origin: "https://evil.example",
      },
      method: "POST",
    });

    expect(() => assertSameOriginMutation(request)).toThrow(RequestSecurityError);
  });

  it("allows API-key automation to bypass the browser origin guard", () => {
    const request = new Request("https://meals.example/api/weeks", {
      headers: {
        authorization: "Bearer mp_test_secret",
        origin: "https://automation.example",
      },
      method: "POST",
    });

    expect(() => assertSameOriginMutation(request)).not.toThrow();
  });

  it("enforces JSON body size limits before parsing", async () => {
    const request = new Request("https://meals.example/api/weeks", {
      body: JSON.stringify({ value: "too much" }),
      headers: {
        "content-length": "1024",
      },
      method: "POST",
    });

    await expect(readJsonWithLimit(request, 16)).rejects.toMatchObject({
      code: "body_too_large",
      status: 413,
    });
  });
});
