import type { ReactNode } from "react";

import {
  parseMarkdown,
  type MarkdownBlock,
  type MarkdownInlineNode,
} from "@/lib/markdown-lite";

function renderInline(nodes: MarkdownInlineNode[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;

    switch (node.type) {
      case "code":
        return (
          <code
            className="rounded bg-[rgba(58,46,31,0.08)] px-1 py-0.5 font-mono text-[0.82em] font-bold text-[var(--ink)]"
            key={key}
          >
            {node.text}
          </code>
        );
      case "emphasis":
        return <em key={key}>{renderInline(node.children, key)}</em>;
      case "link":
        return (
          <a
            className="font-black text-[var(--herb-dark)] underline underline-offset-2"
            href={node.href}
            key={key}
            rel="noreferrer"
            target={node.href.startsWith("/") || node.href.startsWith("#") ? undefined : "_blank"}
          >
            {renderInline(node.children, key)}
          </a>
        );
      case "strong":
        return <strong key={key}>{renderInline(node.children, key)}</strong>;
      case "text":
        return node.text;
    }
  });
}

function renderBlock(block: MarkdownBlock, index: number) {
  const key = `block-${index}`;
  const headingClass = "font-black leading-6 text-[var(--ink)]";

  switch (block.type) {
    case "blockquote":
      return (
        <blockquote
          className="whitespace-pre-wrap border-l-2 border-[var(--herb)] pl-3 italic text-[var(--muted-ink)]"
          key={key}
        >
          {renderInline(block.children, key)}
        </blockquote>
      );
    case "codeBlock":
      return (
        <pre
          className="overflow-x-auto rounded border border-[var(--line)] bg-[rgba(58,46,31,0.06)] p-3 text-xs leading-5 text-[var(--ink)]"
          key={key}
        >
          <code>{block.code}</code>
        </pre>
      );
    case "divider":
      return <hr className="border-[var(--line)]" key={key} />;
    case "heading": {
      const children = renderInline(block.children, key);
      const level = Math.min(block.level + 2, 6);

      if (level === 3) {
        return (
          <h3 className={headingClass} key={key}>
            {children}
          </h3>
        );
      }

      if (level === 4) {
        return (
          <h4 className={headingClass} key={key}>
            {children}
          </h4>
        );
      }

      if (level === 5) {
        return (
          <h5 className={headingClass} key={key}>
            {children}
          </h5>
        );
      }

      return (
        <h6 className={headingClass} key={key}>
          {children}
        </h6>
      );
    }
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";

      return (
        <Tag
          className={`space-y-1 pl-5 ${
            block.ordered ? "list-decimal" : "list-disc"
          }`}
          key={key}
        >
          {block.items.map((item, itemIndex) => (
            <li key={`${key}-item-${itemIndex}`}>
              {renderInline(item, `${key}-item-${itemIndex}`)}
            </li>
          ))}
        </Tag>
      );
    }
    case "paragraph":
      return (
        <p className="whitespace-pre-wrap" key={key}>
          {renderInline(block.children, key)}
        </p>
      );
  }
}

export function MarkdownMessage({ content }: { content: string }) {
  const blocks = parseMarkdown(content);

  return (
    <div className="space-y-2 text-sm font-semibold leading-6">
      {blocks.map(renderBlock)}
    </div>
  );
}
