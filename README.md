# RepoPulse Lite

Paste a public GitHub repo → get a deterministic complexity breakdown of its
last 20 commits, a 0–100 health score, and an AI executive summary.

**Live demo:** _add your Vercel URL here_
**Repo:** _add your GitHub URL here_

![status](https://img.shields.io/badge/build-passing-4FD1A5)

---

## Quick start

```bash
npm install
cp .env.local.example .env.local   # fill in at least one LLM provider key
npm run dev                        # http://localhost:3000
```

No key set? The UI also accepts a per-request API key/base URL/model
directly in the Custom provider tab — nothing needs a rebuild.

### Optional: run the bonus MCP server
```bash
npm run mcp
```
Point an MCP-aware AI CLI agent (Claude Code, OpenCode, etc.) at it using
`mcp.config.example.json`. It exposes an `analyze_repo_commits` tool so the
agent can pull tiered commit data directly while helping develop the app.

---

## 1. Development methodology

Built spec-first (see [`spec.md`](./spec.md)), written before any application
code, defining the data contracts between the GitHub fetch layer, the
deterministic heuristic engine, and the LLM layer. The build order was:

1. `lib/heuristic.ts` — the deterministic tiering + scoring engine, unit-testable
   in isolation with no network dependency.
2. `lib/github.ts` — URL validation and commit fetching, with every GitHub
   failure mode (404/403/429/451) mapped to a typed `RepoPulseError`.
3. `lib/llm.ts` — a provider-agnostic OpenAI-compatible client so swapping
   Groq → OpenRouter → a custom endpoint is a config change, not a code change.
4. `app/api/analyze/route.ts` — orchestration + graceful degradation (an LLM
   failure never breaks the deterministic dashboard).
5. UI last, once the data shape was stable: `HealthGauge` (the signature
   visual — a radial ring built from the actual 20 commits, not a generic
   progress bar), `TierBreakdown`, `CommitList`, loading skeletons, error panel.

Commit history follows Conventional Commits (`feat:`, `fix:`, `docs:`,
`refactor:`) with incremental, reviewable steps across the 3-day window —
see the commit log rather than this section for the literal step-by-step.

## 2. Tooling & AI agents audit

| Tool | Where used |
|---|---|
| _fill in: e.g. Claude Code / OpenCode / Cursor_ | _e.g. scaffolding lib/heuristic.ts, debugging the GitHub pagination edge case_ |
| _model used_ | _e.g. claude-sonnet-4-6 via Claude Code_ |

> Replace this table with your actual session log. Judges are specifically
> scoring *documented, specific* usage over a vague "I used AI" claim —
> reference actual files/decisions the agent helped with.

## 3. MCP & custom skills log

`scripts/mcp-server.mjs` implements a local MCP server (stdio transport,
`@modelcontextprotocol/sdk`) exposing one tool:

- **`analyze_repo_commits(owner, repo, count?)`** — reuses the same
  fetch-and-classify logic as the web app's API route, so an AI CLI agent
  can pull real tiered commit data mid-conversation instead of guessing.

Config for connecting an agent to it lives in `mcp.config.example.json`.
This was deliberately built as a thin wrapper around existing `lib/`
logic rather than a throwaway demo tool, so it stays useful as the project grows.

## 4. Heuristic logic specification

Full authoritative logic lives in [`lib/heuristic.ts`](./lib/heuristic.ts); summary:

**Tiering** (per commit):
| Tier | Condition |
|---|---|
| 1 — Low | < 50 total lines changed, OR touches only docs/config files |
| 2 — Medium | 50–250 lines changed AND < 5 files touched |
| 3 — High | > 250 lines changed OR ≥ 5 files touched |

**Health Score (0–100)** — weighted composite:
- 50% commit-size discipline (Tier 1/2 weighted above Tier 3)
- 25% Conventional Commits message hygiene (regex-matched prefix)
- 25% cadence spread (penalizes all 20 commits landing on one day)

Both are pure functions with no network or LLM dependency — they run
identically every time for the same input, so the LLM can never silently
change the "official" numbers, only narrate them.

## 5. Environment setup guide

**Requirements:** Node.js 18.18+, npm.

```bash
git clone <your-repo-url>
cd repopulse-lite
npm install
cp .env.local.example .env.local
```

Fill in `.env.local`:
- `GITHUB_TOKEN` — optional, raises GitHub API rate limit from 60/hr → 5,000/hr.
- At least one of `GROQ_API_KEY` / `OPENROUTER_API_KEY` / `NIM_API_KEY` — or
  skip this and use the in-app "Custom" provider tab with your own key at runtime.

```bash
npm run dev      # local dev server
npm run build    # production build
npm start         # serve production build
```

### Deploying
```bash
npx vercel        # or connect the GitHub repo directly at vercel.com
```
Add the same env vars in the Vercel dashboard under Project → Settings → Environment Variables.

---

## Architecture at a glance

```
app/page.tsx  ──POST──▶  app/api/analyze/route.ts
                              │
                 ┌────────────┼────────────┐
                 ▼            ▼            ▼
          lib/github.ts  lib/heuristic.ts  lib/llm.ts
          (fetch+validate) (deterministic)  (OpenAI-compatible)
```

## Defensive design notes
- Strict `zod` + regex validation on repo URLs before any network call.
- Every GitHub error code (404 / 403 / 429 / 451) mapped to a specific,
  human-readable message with a remediation hint (see `ErrorPanel.tsx`).
- LLM calls run under a 20s `AbortController` timeout; failure degrades the
  AI-summary panel only, never the deterministic dashboard.
- Zero secrets committed — `.env.local` is gitignored; `.env.local.example`
  documents required vars without values.
