"use client";

import { Check, ClipboardCopy } from "lucide-react";
import { useRef, useState } from "react";

export function PlannerBriefCopy({
  briefMarkdown,
}: {
  briefMarkdown: string;
}) {
  const briefRef = useRef<HTMLTextAreaElement>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"copied" | "idle" | "selected">("idle");

  async function writeClipboardText(value: string) {
    try {
      await navigator.clipboard.writeText(value);

      return true;
    } catch {
      const clipboardProxy = document.createElement("textarea");
      clipboardProxy.value = value;
      clipboardProxy.setAttribute("readonly", "");
      clipboardProxy.style.left = "-9999px";
      clipboardProxy.style.position = "fixed";
      clipboardProxy.style.top = "0";
      document.body.appendChild(clipboardProxy);
      clipboardProxy.focus();
      clipboardProxy.select();

      try {
        if (!document.execCommand("copy")) {
          return false;
        }

        return true;
      } finally {
        document.body.removeChild(clipboardProxy);
      }
    }
  }

  async function copyBrief() {
    const localNotes = notes.trim()
      ? `## Local Notes\n\n${notes.trim()}\n\n`
      : "";

    try {
      const copied = await writeClipboardText(`${localNotes}${briefMarkdown}`);

      if (!copied) {
        briefRef.current?.focus();
        briefRef.current?.select();
        setStatus("selected");
        setCopyError("Clipboard was blocked, so the generated brief was selected.");

        return;
      }

      setStatus("copied");
      setCopyError(null);
      window.setTimeout(() => setStatus("idle"), 1800);
    } catch {
      briefRef.current?.focus();
      briefRef.current?.select();
      setStatus("selected");
      setCopyError("Clipboard was blocked, so the generated brief was selected.");
    }
  }

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="ka-label">Local notes</span>
        <textarea
          className="ka-textarea mt-1 min-h-24 text-sm leading-6"
          onChange={(event) => setNotes(event.target.value)}
          placeholder="Optional notes to prepend when copying."
          value={notes}
        />
      </label>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button className="ka-button gap-2" onClick={copyBrief} type="button">
          {status === "idle" ? <ClipboardCopy size={16} /> : <Check size={16} />}
          {status === "copied"
            ? "Copied"
            : status === "selected"
              ? "Brief selected"
              : "Copy planner brief"}
        </button>
        {copyError ? (
          <p className="text-sm font-semibold text-[var(--muted-ink)]">
            {copyError}
          </p>
        ) : null}
      </div>

      <label className="block">
        <span className="ka-label">Generated brief</span>
        <textarea
          className="ka-textarea mt-1 min-h-[36rem] font-mono text-xs leading-5"
          ref={briefRef}
          readOnly
          value={briefMarkdown}
        />
      </label>
    </div>
  );
}
