import { describe, expect, it } from "vitest";

import { parseMarkdown, parseMarkdownInline } from "./markdown-lite";

describe("markdown-lite", () => {
  it("parses common assistant markdown blocks", () => {
    expect(
      parseMarkdown(`# Prep tip

- **Chop** onions
- Chill sauce

1. Preheat
2. Bake

> Keep it practical.

\`\`\`text
salt
pepper
\`\`\``),
    ).toMatchObject([
      { level: 1, type: "heading" },
      { items: expect.any(Array), ordered: false, type: "list" },
      { items: expect.any(Array), ordered: true, type: "list" },
      { type: "blockquote" },
      { code: "salt\npepper", language: "text", type: "codeBlock" },
    ]);
  });

  it("parses safe inline markdown without allowing unsafe links", () => {
    expect(
      parseMarkdownInline(
        "Use **less salt**, _taste_, `rest`, [source](https://example.com), [bad](javascript:alert(1)).",
      ),
    ).toMatchObject([
      { text: "Use ", type: "text" },
      { type: "strong" },
      { text: ", ", type: "text" },
      { type: "emphasis" },
      { text: ", ", type: "text" },
      { text: "rest", type: "code" },
      { text: ", ", type: "text" },
      { href: "https://example.com", type: "link" },
      { text: ", bad.", type: "text" },
    ]);
  });
});
