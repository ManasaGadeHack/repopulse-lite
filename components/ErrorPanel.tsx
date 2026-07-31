const CODE_HINTS: Record<string, string> = {
  NOT_FOUND: "Double-check the URL — the repo may be private, deleted, or renamed.",
  RATE_LIMITED: "GitHub's public API allows 60 requests/hour unauthenticated. Add GITHUB_TOKEN to .env.local, or wait and retry.",
  FORBIDDEN: "This repository can't be accessed — it's likely private. RepoPulse Lite only supports public repos.",
  LLM_TIMEOUT: "The LLM provider took too long to respond. Try again, or switch providers.",
  LLM_CONFIG_MISSING: "Add an API key for the selected provider, or switch to a custom endpoint.",
  INVALID_URL: "Use the format https://github.com/owner/repo.",
};

export function ErrorPanel({ code, message }: { code: string; message: string }) {
  return (
    <div className="rounded-lg border border-tier3/30 bg-tier3/10 p-6 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-tier3" />
        <span className="font-mono text-xs uppercase tracking-wide text-tier3">{code}</span>
      </div>
      <p className="text-sm text-ink">{message}</p>
      {CODE_HINTS[code] && <p className="text-xs text-muted">{CODE_HINTS[code]}</p>}
    </div>
  );
}
