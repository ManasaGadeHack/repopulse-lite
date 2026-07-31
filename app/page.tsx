"use client";

import { useState } from "react";
import { HealthGauge } from "@/components/HealthGauge";
import { TierBreakdown } from "@/components/TierBreakdown";
import { CommitList } from "@/components/CommitList";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { ErrorPanel } from "@/components/ErrorPanel";
import { ProviderSelector, type LlmFormState } from "@/components/ProviderSelector";
import type { TieredCommit, TierBreakdown as TierBreakdownType } from "@/lib/heuristic";

interface AnalyzeResult {
  repo: string;
  healthScore: number;
  breakdown: TierBreakdownType;
  commits: TieredCommit[];
  summary: { momentum: string; risks: string; hygiene: string; recommendations: string[] };
}

type ViewState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; code: string; message: string }
  | { status: "success"; data: AnalyzeResult };

export default function HomePage() {
  const [repoUrl, setRepoUrl] = useState("");
  const [llm, setLlm] = useState<LlmFormState>({ preset: "groq", baseUrl: "", apiKey: "", model: "" });
  const [view, setView] = useState<ViewState>({ status: "idle" });

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setView({ status: "loading" });
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl,
          llm: {
            preset: llm.preset,
            baseUrl: llm.baseUrl || undefined,
            apiKey: llm.apiKey || undefined,
            model: llm.model || undefined,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setView({ status: "error", code: json.error?.code ?? "UNKNOWN", message: json.error?.message ?? "Request failed." });
        return;
      }
      setView({ status: "success", data: json });
    } catch {
      setView({ status: "error", code: "NETWORK_ERROR", message: "Could not reach the server. Check your connection and try again." });
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <header className="mb-10 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-brand">
          <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulseRing" />
          RepoPulse Lite
        </div>
        <h1 className="font-display text-4xl font-bold text-ink sm:text-5xl">
          Repository momentum, <span className="text-brand">read at a glance.</span>
        </h1>
        <p className="max-w-2xl text-muted">
          Paste any public GitHub repository. We fetch the last 20 commits, run a deterministic
          complexity heuristic, and let an AI summarize momentum, risk, and hygiene — the numbers
          come from code, not the model.
        </p>
      </header>

      <form onSubmit={handleAnalyze} className="mb-10 flex flex-col gap-4 rounded-lg border border-line bg-surface p-6">
        <div className="flex flex-col gap-2">
          <label htmlFor="repoUrl" className="text-sm font-medium text-ink">Repository URL</label>
          <input
            id="repoUrl"
            required
            className="focus-ring rounded-md border border-line bg-surface2 px-4 py-3 font-mono text-sm placeholder:text-muted"
            placeholder="https://github.com/vercel/next.js"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-ink">LLM Provider</span>
          <ProviderSelector state={llm} onChange={setLlm} />
        </div>

        <button
          type="submit"
          disabled={view.status === "loading"}
          className="focus-ring self-start rounded-md bg-brand px-5 py-2.5 text-sm font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {view.status === "loading" ? "Analyzing…" : "Analyze Repository"}
        </button>
      </form>

      {view.status === "loading" && <LoadingSkeleton />}
      {view.status === "error" && <ErrorPanel code={view.code} message={view.message} />}

      {view.status === "success" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1 flex flex-col items-center justify-center gap-4 rounded-lg border border-line bg-surface p-6">
            <HealthGauge score={view.data.healthScore} commits={view.data.commits} />
            <span className="font-mono text-sm text-muted">{view.data.repo}</span>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="rounded-lg border border-line bg-surface p-6">
              <h2 className="mb-4 font-display text-lg font-semibold">Tier Breakdown</h2>
              <TierBreakdown breakdown={view.data.breakdown} />
            </div>

            <div className="rounded-lg border border-line bg-surface p-6">
              <h2 className="mb-4 font-display text-lg font-semibold">AI Executive Summary</h2>
              <ul className="flex flex-col gap-3 text-sm">
                <li><span className="font-medium text-brand">Momentum — </span><span className="text-ink">{view.data.summary.momentum}</span></li>
                <li><span className="font-medium text-tier3">Risks — </span><span className="text-ink">{view.data.summary.risks}</span></li>
                <li><span className="font-medium text-tier1">Hygiene — </span><span className="text-ink">{view.data.summary.hygiene}</span></li>
              </ul>
            </div>

            {view.data.summary.recommendations.length > 0 && (
              <div className="rounded-lg border border-brand/30 bg-brand/5 p-6">
                <h2 className="mb-4 font-display text-lg font-semibold text-ink">Recommendations</h2>
                <ul className="flex flex-col gap-3">
                  {view.data.summary.recommendations.map((rec, i) => (
                    <li key={i} className="flex gap-3 text-sm">
                      <span className="mt-0.5 shrink-0 font-mono text-xs text-brand">{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-ink">{rec}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg border border-line bg-surface p-6">
              <h2 className="mb-2 font-display text-lg font-semibold">Recent Commits</h2>
              <CommitList commits={view.data.commits} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
