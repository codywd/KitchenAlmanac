"use client";

import { KeyRound, RefreshCw, Save, Trash2 } from "lucide-react";
import { useActionState, useMemo, useState } from "react";

import {
  deleteLlmSettingsAction,
  saveLlmSettingsAction,
  type DeleteLlmSettingsActionState,
  type LlmSettingsActionState,
} from "@/app/llm-actions";
import {
  defaultLlmBaseUrl,
  type LlmModelOption,
  type LlmProviderKind,
} from "@/lib/llm-provider";
import type { SafeUserLlmSettings } from "@/lib/llm-settings";

const initialState: LlmSettingsActionState = {};
const initialDeleteState: DeleteLlmSettingsActionState = {};

const providerLabels: Record<LlmProviderKind, string> = {
  ANTHROPIC_COMPATIBLE: "Anthropic-compatible",
  OPENAI_COMPATIBLE: "OpenAI-compatible",
};

export function LlmSettingsForm({
  settings,
}: {
  settings: SafeUserLlmSettings | null;
}) {
  const [state, action, pending] = useActionState(
    saveLlmSettingsAction,
    initialState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteLlmSettingsAction,
    initialDeleteState,
  );
  const effectiveSettings = state.settings ?? settings;
  const [providerKind, setProviderKind] = useState<LlmProviderKind>(
    effectiveSettings?.providerKind ?? "OPENAI_COMPATIBLE",
  );
  const [baseUrl, setBaseUrl] = useState(
    effectiveSettings?.baseUrl ?? defaultLlmBaseUrl(providerKind),
  );
  const [apiKey, setApiKey] = useState("");
  const [modelId, setModelId] = useState(effectiveSettings?.modelId ?? "");
  const [displayName, setDisplayName] = useState(
    effectiveSettings?.displayName ?? "",
  );
  const [models, setModels] = useState<LlmModelOption[]>(
    effectiveSettings?.modelId
      ? [{ id: effectiveSettings.modelId, name: effectiveSettings.modelId }]
      : [],
  );
  const [modelError, setModelError] = useState("");
  const [modelLoading, setModelLoading] = useState(false);
  const modelOptions = useMemo(() => {
    if (!modelId || models.some((model) => model.id === modelId)) {
      return models;
    }

    return [{ id: modelId, name: modelId }, ...models];
  }, [modelId, models]);

  function updateProvider(nextProvider: LlmProviderKind) {
    setProviderKind(nextProvider);
    setBaseUrl(defaultLlmBaseUrl(nextProvider));
    setModels([]);
    setModelId("");
    setModelError("");
  }

  async function fetchModels() {
    setModelError("");
    setModelLoading(true);

    try {
      const response = await fetch("/api/llm/models", {
        body: JSON.stringify({
          apiKey,
          baseUrl,
          providerKind,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const body = (await response.json()) as {
        error?: string;
        models?: LlmModelOption[];
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Could not fetch models.");
      }

      const nextModels = body.models ?? [];
      setModels(nextModels);

      if (!nextModels.some((model) => model.id === modelId)) {
        setModelId(nextModels[0]?.id ?? "");
      }
    } catch (error) {
      setModelError(
        error instanceof Error ? error.message : "Could not fetch models.",
      );
    } finally {
      setModelLoading(false);
    }
  }

  return (
    <div className="ka-panel space-y-4">
      <form action={action} className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <label className="block">
            <span className="ka-label">Provider</span>
            <select
              className="ka-select mt-1"
              name="providerKind"
              onChange={(event) =>
                updateProvider(event.target.value as LlmProviderKind)
              }
              value={providerKind}
            >
              {Object.entries(providerLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="ka-label">Display name</span>
            <input
              className="ka-field mt-1"
              name="displayName"
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Kitchen helper"
              value={displayName}
            />
          </label>
        </div>

        <label className="block">
          <span className="ka-label">Base URL</span>
          <input
            className="ka-field mt-1 font-mono text-sm"
            name="baseUrl"
            onChange={(event) => setBaseUrl(event.target.value)}
            required
            value={baseUrl}
          />
        </label>

        <label className="block">
          <span className="ka-label">API key</span>
          <input
            autoComplete="off"
            className="ka-field mt-1 font-mono text-sm"
            name="apiKey"
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={
              effectiveSettings?.hasApiKey
                ? "Stored key will be kept"
                : "Provider API key"
            }
            type="password"
            value={apiKey}
          />
        </label>

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <label className="block">
            <span className="ka-label">Model</span>
            <select
              className="ka-select mt-1"
              disabled={!modelOptions.length}
              name="modelId"
              onChange={(event) => setModelId(event.target.value)}
              required
              value={modelId}
            >
              {modelOptions.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="ka-button-secondary gap-2 disabled:opacity-60"
            disabled={modelLoading}
            onClick={fetchModels}
            type="button"
          >
            <RefreshCw size={16} />
            {modelLoading ? "Fetching" : "Fetch models"}
          </button>
        </div>

        <button
          className="ka-button gap-2 disabled:opacity-60"
          disabled={pending || !modelId}
        >
          <Save size={16} />
          Save LLM
        </button>
      </form>

      {modelError ? <div className="ka-error text-sm">{modelError}</div> : null}
      {state.error ? <div className="ka-error text-sm">{state.error}</div> : null}
      {state.message ? (
        <div className="ka-success text-sm">{state.message}</div>
      ) : null}

      {effectiveSettings ? (
        <div className="flex flex-col justify-between gap-3 border-t border-[var(--line)] pt-4 md:flex-row md:items-center">
          <div className="min-w-0 text-sm font-semibold text-[var(--muted-ink)]">
            <div className="flex items-center gap-2 font-black text-[var(--ink)]">
              <KeyRound size={16} />
              {providerLabels[effectiveSettings.providerKind]}
            </div>
            <div className="mt-1 truncate font-mono text-xs">
              {effectiveSettings.modelId} / key {effectiveSettings.keyFingerprint}
            </div>
          </div>
          <form action={deleteAction}>
            <button className="ka-button-danger gap-2" disabled={deletePending}>
              <Trash2 size={16} />
              Delete
            </button>
          </form>
        </div>
      ) : null}
      {deleteState.message ? (
        <div className="ka-success text-sm">{deleteState.message}</div>
      ) : null}
    </div>
  );
}
