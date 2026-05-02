"use client";

import { Bot, Send, UserRound } from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

import { MarkdownMessage } from "./markdown-message";

type ChatMessage = {
  content: string;
  role: "assistant" | "user";
};

export function RecipeChatBox({
  enabled,
  mealId,
  modelLabel,
}: {
  enabled: boolean;
  mealId: string;
  modelLabel?: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const canSend = useMemo(
    () => Boolean(enabled && draft.trim() && !pending),
    [draft, enabled, pending],
  );

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSend) {
      return;
    }

    const nextMessages: ChatMessage[] = [
      ...messages,
      {
        content: draft.trim(),
        role: "user",
      },
    ];

    setMessages(nextMessages);
    setDraft("");
    setError("");
    setPending(true);

    try {
      const response = await fetch("/api/llm/chat", {
        body: JSON.stringify({
          mealId,
          messages: nextMessages,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const body = (await response.json()) as {
        error?: string;
        reply?: string;
      };

      if (!response.ok || !body.reply) {
        throw new Error(body.error ?? "Recipe chat failed.");
      }

      setMessages([
        ...nextMessages,
        {
          content: body.reply,
          role: "assistant",
        },
      ]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Recipe chat failed.");
      setMessages(messages);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="border-t border-[var(--line)] py-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="recipe-display text-xl font-semibold text-[var(--herb-dark)]">
            Recipe Chat
          </h2>
          {modelLabel ? (
            <p className="mt-1 text-xs font-black uppercase tracking-[0.12em] text-[var(--muted-ink)]">
              {modelLabel}
            </p>
          ) : null}
        </div>
        <Bot className="text-[var(--tomato)]" size={20} />
      </div>

      {!enabled ? (
        <div className="ka-note mt-3 text-sm font-semibold leading-6">
          <p>Connect an LLM in Account to ask about this recipe.</p>
          <Link className="ka-button-secondary mt-3 w-full gap-2" href="/account">
            <Bot size={16} />
            Account
          </Link>
        </div>
      ) : (
        <>
          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-1">
            {messages.length ? (
              messages.map((message, index) => (
                <div
                  className={`flex gap-2 ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                  key={`${message.role}-${index}`}
                >
                  {message.role === "assistant" ? (
                    <Bot className="mt-2 shrink-0 text-[var(--herb)]" size={16} />
                  ) : null}
                  <div
                    className={`max-w-[88%] border px-3 py-2 ${
                      message.role === "user"
                        ? "whitespace-pre-wrap border-[var(--tomato)] bg-[rgba(209,91,62,0.1)] text-sm font-semibold leading-6 text-[var(--ink)]"
                        : "border-[var(--line)] bg-[rgba(255,253,245,0.54)] text-[var(--muted-ink)]"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      <MarkdownMessage content={message.content} />
                    ) : (
                      message.content
                    )}
                  </div>
                  {message.role === "user" ? (
                    <UserRound className="mt-2 shrink-0 text-[var(--tomato)]" size={16} />
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm font-semibold leading-6 text-[var(--muted-ink)]">
                No messages yet.
              </p>
            )}
          </div>

          <form className="mt-4 space-y-2" onSubmit={onSubmit}>
            <label className="block">
              <span className="ka-label">Question</span>
              <textarea
                className="ka-textarea mt-1 min-h-24 bg-transparent px-0 py-2 text-sm leading-6"
                onChange={(event) => setDraft(event.target.value)}
                placeholder="Can I prep this earlier?"
                value={draft}
              />
            </label>
            <button
              className="ka-button w-full gap-2 disabled:opacity-60"
              disabled={!canSend}
            >
              <Send size={16} />
              {pending ? "Asking" : "Ask"}
            </button>
          </form>
          {error ? <div className="ka-error mt-3 text-sm">{error}</div> : null}
        </>
      )}
    </section>
  );
}
