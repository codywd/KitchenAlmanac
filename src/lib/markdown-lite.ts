export type MarkdownInlineNode =
  | {
      text: string;
      type: "text";
    }
  | {
      text: string;
      type: "code";
    }
  | {
      children: MarkdownInlineNode[];
      type: "emphasis" | "strong";
    }
  | {
      children: MarkdownInlineNode[];
      href: string;
      type: "link";
    };

export type MarkdownBlock =
  | {
      children: MarkdownInlineNode[];
      type: "paragraph";
    }
  | {
      children: MarkdownInlineNode[];
      level: number;
      type: "heading";
    }
  | {
      code: string;
      language?: string;
      type: "codeBlock";
    }
  | {
      children: MarkdownInlineNode[];
      type: "blockquote";
    }
  | {
      items: MarkdownInlineNode[][];
      ordered: boolean;
      type: "list";
    }
  | {
      type: "divider";
    };

const blockStartPattern =
  /^(#{1,6})\s+|^```|^>\s?|^\s*([-*+])\s+|^\s*\d+[.)]\s+|^\s{0,3}([-*_])(?:\s*\2){2,}\s*$/u;

function isSafeLink(href: string) {
  if (href.startsWith("/") || href.startsWith("#")) {
    return true;
  }

  try {
    const parsed = new URL(href);

    return ["http:", "https:", "mailto:"].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function findMatching(value: string, delimiter: string, start: number) {
  const matchIndex = value.indexOf(delimiter, start + delimiter.length);

  return matchIndex > start + delimiter.length ? matchIndex : -1;
}

function findLinkHrefEnd(value: string, start: number) {
  let depth = 0;

  for (let index = start; index < value.length; index += 1) {
    if (value[index] === "(") {
      depth += 1;
      continue;
    }

    if (value[index] === ")") {
      if (depth === 0) {
        return index;
      }

      depth -= 1;
    }
  }

  return -1;
}

function pushText(nodes: MarkdownInlineNode[], text: string) {
  if (!text) {
    return;
  }

  const last = nodes.at(-1);

  if (last?.type === "text") {
    last.text += text;
    return;
  }

  nodes.push({ text, type: "text" });
}

export function parseMarkdownInline(value: string): MarkdownInlineNode[] {
  const nodes: MarkdownInlineNode[] = [];
  let index = 0;

  while (index < value.length) {
    if (value[index] === "`") {
      const end = findMatching(value, "`", index);

      if (end > -1) {
        nodes.push({ text: value.slice(index + 1, end), type: "code" });
        index = end + 1;
        continue;
      }
    }

    const strongDelimiter = value.startsWith("**", index)
      ? "**"
      : value.startsWith("__", index)
        ? "__"
        : null;

    if (strongDelimiter) {
      const end = findMatching(value, strongDelimiter, index);

      if (end > -1) {
        nodes.push({
          children: parseMarkdownInline(
            value.slice(index + strongDelimiter.length, end),
          ),
          type: "strong",
        });
        index = end + strongDelimiter.length;
        continue;
      }
    }

    if (
      (value[index] === "*" && !value.startsWith("**", index)) ||
      (value[index] === "_" && !value.startsWith("__", index))
    ) {
      const delimiter = value[index];
      const end = findMatching(value, delimiter, index);

      if (end > -1) {
        nodes.push({
          children: parseMarkdownInline(value.slice(index + 1, end)),
          type: "emphasis",
        });
        index = end + 1;
        continue;
      }
    }

    if (value[index] === "[") {
      const labelEnd = value.indexOf("](", index + 1);

      if (labelEnd > -1) {
        const hrefEnd = findLinkHrefEnd(value, labelEnd + 2);

        if (hrefEnd > -1) {
          const label = value.slice(index + 1, labelEnd);
          const href = value.slice(labelEnd + 2, hrefEnd).trim();

          if (href && isSafeLink(href)) {
            nodes.push({
              children: parseMarkdownInline(label),
              href,
              type: "link",
            });
          } else {
            pushText(nodes, label);
          }

          index = hrefEnd + 1;
          continue;
        }
      }
    }

    const nextSpecial = value
      .slice(index + 1)
      .search(/[`*_[]/u);
    const end = nextSpecial === -1 ? value.length : index + 1 + nextSpecial;

    pushText(nodes, value.slice(index, end));
    index = end;
  }

  return nodes;
}

export function parseMarkdown(value: string): MarkdownBlock[] {
  const lines = value.replace(/\r\n?/gu, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = line.match(/^```\s*([\w-]+)?\s*$/u);

    if (fence) {
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      blocks.push({
        code: codeLines.join("\n"),
        language: fence[1],
        type: "codeBlock",
      });
      continue;
    }

    const divider = line.match(/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/u);

    if (divider) {
      blocks.push({ type: "divider" });
      index += 1;
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/u);

    if (heading) {
      blocks.push({
        children: parseMarkdownInline(heading[2].trim()),
        level: heading[1].length,
        type: "heading",
      });
      index += 1;
      continue;
    }

    if (/^>\s?/u.test(line)) {
      const quoteLines: string[] = [];

      while (index < lines.length && /^>\s?/u.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/u, ""));
        index += 1;
      }

      blocks.push({
        children: parseMarkdownInline(quoteLines.join("\n")),
        type: "blockquote",
      });
      continue;
    }

    const unordered = line.match(/^\s*[-*+]\s+(.+)$/u);

    if (unordered) {
      const items: MarkdownInlineNode[][] = [];

      while (index < lines.length) {
        const item = lines[index].match(/^\s*[-*+]\s+(.+)$/u);

        if (!item) {
          break;
        }

        items.push(parseMarkdownInline(item[1].trim()));
        index += 1;
      }

      blocks.push({ items, ordered: false, type: "list" });
      continue;
    }

    const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/u);

    if (ordered) {
      const items: MarkdownInlineNode[][] = [];

      while (index < lines.length) {
        const item = lines[index].match(/^\s*\d+[.)]\s+(.+)$/u);

        if (!item) {
          break;
        }

        items.push(parseMarkdownInline(item[1].trim()));
        index += 1;
      }

      blocks.push({ items, ordered: true, type: "list" });
      continue;
    }

    const paragraphLines: string[] = [];

    while (
      index < lines.length &&
      lines[index].trim() &&
      !blockStartPattern.test(lines[index])
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    blocks.push({
      children: parseMarkdownInline(paragraphLines.join("\n")),
      type: "paragraph",
    });
  }

  return blocks;
}
