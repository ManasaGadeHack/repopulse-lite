# RepoPulse Lite — Architectural Spec

_Written before implementation, per the Spec-Driven Agentic Development workflow._

## 1. Goal
Given a public GitHub repo URL, produce: a 0–100 health score, a Tier 1/2/3
commit complexity breakdown, and a 3-bullet AI executive summary — without
manual log review.

## 2. Non-negotiables
- The complexity tiering is **deterministic code**, computed before any LLM
  call. The LLM narrates the numbers; it never invents them.
- Zero secrets in the repo. All keys via `.env.local` / runtime input only.
- The app must degrade gracefully: a dead LLM provider should never break
  the deterministic dashboard, only the AI-summary panel.

## 3. System design

```
Browser (page.tsx)
   │  POST /api/analyze { repoUrl, llm }
   ▼
API Route (app/api/analyze/route.ts)
   │
   ├─▶ lib/github.ts     — validate URL, fetch 20 commits + stats (GitHub REST)
   ├─▶ lib/heuristic.ts  — pure function: commit stats → Tier 1/2/3 + health score
   └─▶ lib/llm.ts        — OpenAI-compatible call to Groq/OpenRouter/NIM/custom
   │
   ▼
JSON response → dashboard (HealthGauge, TierBreakdown, CommitList)
```

## 4. Data flow contracts
- `CommitStats` (raw GitHub data) → `classifyCommit()` → `TieredCommit`
  (adds `tier`, `tierLabel`, `reason`). This is the single seam between
  "fact" and "interpretation" in the codebase.
- The LLM prompt is built from already-tiered data (`buildPrompt` in
  `lib/llm.ts`) and explicitly instructed not to recompute the score —
  it's told the numbers and asked only for prose judgment.

## 5. Heuristic (see lib/heuristic.ts for authoritative logic)
- **Tier 1 (Low):** < 50 total lines changed, or docs/config-only diff.
- **Tier 2 (Medium):** 50–250 lines changed, across < 5 files.
- **Tier 3 (High):** > 250 lines changed, or ≥ 5 files touched.
- **Health Score** = 50% commit-size discipline + 25% conventional-commit
  message hygiene + 25% cadence spread across days (penalizes one giant
  commit dump).

## 6. Failure modes handled explicitly
| Condition | Behavior |
|---|---|
| Invalid/non-GitHub URL | 400, `INVALID_URL`, rejected before any network call |
| Private or nonexistent repo | 404/403, human-readable message |
| GitHub rate limit hit | 429 with reset time, hint to add `GITHUB_TOKEN` |
| LLM timeout (20s) | Dashboard still renders; summary panel shows fallback text |
| LLM returns non-JSON | Caught, parse error surfaced, doesn't crash the request |
| Empty repo (0 commits) | 404, explicit "no commits yet" message |

## 7. Out of scope for the 3-day sprint
- Auth / multi-user accounts
- Persisting analysis history (stateless per-request by design)
- Private repo support (would require OAuth flow — noted as a future extension)
