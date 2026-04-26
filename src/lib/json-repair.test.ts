import { describe, expect, it } from "vitest";

import { parseJsonWithRepair } from "./json-repair";

describe("parseJsonWithRepair", () => {
  it("repairs smart quotes used as JSON delimiters", () => {
    const result = parseJsonWithRepair(
      "{“schema_version”:“1.0”,“recipes”:[{“dinner_title”:“Pasta e Ceci”}]}",
    );

    expect(result.repaired).toBe(true);
    expect(result.text).toBe(
      '{"schema_version":"1.0","recipes":[{"dinner_title":"Pasta e Ceci"}]}',
    );
    expect(result.value).toEqual({
      recipes: [{ dinner_title: "Pasta e Ceci" }],
      schema_version: "1.0",
    });
  });

  it("leaves already valid JSON with smart quote content unchanged", () => {
    const text = '{"note":"Serve “as-is” tonight."}';
    const result = parseJsonWithRepair(text);

    expect(result.repaired).toBe(false);
    expect(result.text).toBe(text);
    expect(result.value).toEqual({ note: "Serve “as-is” tonight." });
  });

  it("strips markdown fences and trailing commas", () => {
    const result = parseJsonWithRepair(
      '```json\n{"recipes":[{"dinner_title":"Turkey Bowls",}],}\n```',
    );

    expect(result.repaired).toBe(true);
    expect(result.text).toBe('{"recipes":[{"dinner_title":"Turkey Bowls"}]}');
    expect(result.value).toEqual({
      recipes: [{ dinner_title: "Turkey Bowls" }],
    });
  });

  it("reports unrepairable JSON", () => {
    expect(() => parseJsonWithRepair("not json")).toThrow(
      "Could not parse JSON after applying common LLM JSON repairs.",
    );
  });
});
