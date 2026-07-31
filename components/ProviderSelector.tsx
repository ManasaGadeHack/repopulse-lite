"use client";

import clsx from "clsx";

export interface LlmFormState {
  preset: "groq" | "openrouter" | "nim" | "custom";
  baseUrl: string;
  apiKey: string;
  model: string;
}

const PRESETS: { id: LlmFormState["preset"]; label: string; note: string }[] = [
  { id: "groq", label: "Groq", note: "Free tier · llama-3.3-70b" },
  { id: "nim", label: "NVIDIA NIM", note: "Free tier · llama-3.3-70b" },
  { id: "custom", label: "Custom", note: "Bring your own endpoint" },
];

export function ProviderSelector({
  state,
  onChange,
}: {
  state: LlmFormState;
  onChange: (next: LlmFormState) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange({ ...state, preset: p.id })}
            className={clsx(
              "focus-ring rounded-md border px-3 py-2 text-left text-sm transition-colors",
              state.preset === p.id
                ? "border-brand bg-brand/10 text-ink"
                : "border-line bg-surface2 text-muted hover:text-ink"
            )}
          >
            <div className="font-medium">{p.label}</div>
            <div className="text-[11px] text-muted">{p.note}</div>
          </button>
        ))}
      </div>

      {state.preset === "custom" && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <input
            className="focus-ring rounded-md border border-line bg-surface2 px-3 py-2 text-sm placeholder:text-muted"
            placeholder="Base URL (e.g. https://your-host/v1)"
            value={state.baseUrl}
            onChange={(e) => onChange({ ...state, baseUrl: e.target.value })}
          />
          <input
            className="focus-ring rounded-md border border-line bg-surface2 px-3 py-2 text-sm placeholder:text-muted"
            placeholder="Model name"
            value={state.model}
            onChange={(e) => onChange({ ...state, model: e.target.value })}
          />
          <input
            className="focus-ring rounded-md border border-line bg-surface2 px-3 py-2 text-sm placeholder:text-muted"
            placeholder="API key"
            type="password"
            value={state.apiKey}
            onChange={(e) => onChange({ ...state, apiKey: e.target.value })}
          />
        </div>
      )}

      {state.preset !== "custom" && (
        <input
          className="focus-ring rounded-md border border-line bg-surface2 px-3 py-2 text-sm placeholder:text-muted"
          placeholder={`Optional: override API key for ${state.preset} (else read from server .env.local)`}
          type="password"
          value={state.apiKey}
          onChange={(e) => onChange({ ...state, apiKey: e.target.value })}
        />
      )}
    </div>
  );
}
