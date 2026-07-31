import { RepoPulseError } from "./github";
import type { TieredCommit, TierBreakdown } from "./heuristic";

export type LlmProviderPreset = "groq" | "openrouter" | "nim" | "custom";

export interface LlmConfig {
  preset: LlmProviderPreset;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

const PRESET_DEFAULTS: Record<Exclude<LlmProviderPreset, "custom">, { baseUrl: string; model: string; envKey: string }> = {
  groq: {
    baseUrl: "https://api.groq.com/openai/v1",
    model: "llama-3.3-70b-versatile",
    envKey: "GROQ_API_KEY",
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    model: "meta-llama/llama-3.3-70b-instruct:free",
    envKey: "OPENROUTER_API_KEY",
  },
  nim: {
    baseUrl: "https://integrate.api.nvidia.com/v1",
    model: "meta/llama-3.3-70b-instruct",
    envKey: "NIM_API_KEY",
  },
};

export interface ExecutiveSummary {
  momentum: string;
  risks: string;
  hygiene: string;
  recommendations: string[];
}

function resolveConfig(config: LlmConfig): { baseUrl: string; model: string; apiKey: string } {
  if (config.preset === "custom") {
    if (!config.baseUrl || !config.apiKey || !config.model) {
      throw new RepoPulseError(
        "LLM_CONFIG_MISSING",
        "Custom provider requires baseUrl, apiKey, and model.",
        400
      );
    }
    return { baseUrl: config.baseUrl, model: config.model, apiKey: config.apiKey };
  }

  const preset = PRESET_DEFAULTS[config.preset];
  const apiKey = config.apiKey ?? process.env[preset.envKey];
  if (!apiKey) {
    throw new RepoPulseError(
      "LLM_CONFIG_MISSING",
      `No API key found for ${config.preset}. Set ${preset.envKey} in .env.local or pass one in the UI.`,
      400
    );
  }
  return { baseUrl: preset.baseUrl, model: config.model ?? preset.model, apiKey };
}

function buildPrompt(
  owner: string,
  repo: string,
  commits: TieredCommit[],
  breakdown: TierBreakdown,
  healthScore: number
): string {
  const commitLines = commits
    .map((c) => `- [${c.tierLabel}] ${c.shortSha} "${c.message}" (+${c.additions}/-${c.deletions}, ${c.filesChanged} files) — ${c.author}`)
    .join("\n");

  return `You are a senior engineering manager producing a terse executive report for ${owner}/${repo}.

Deterministic analysis already computed (do NOT recompute or contradict these numbers):
- Health Score: ${healthScore}/100
- Tier breakdown: ${breakdown.tier1} Low, ${breakdown.tier2} Medium, ${breakdown.tier3} High complexity commits (of ${breakdown.total} analyzed)

Recent commits:
${commitLines}

Also propose 2-3 concrete, actionable recommendations grounded in the actual commits above
(e.g. naming a specific oversized commit or a pattern in the messages) — not generic advice
that could apply to any repo.

Respond with STRICT JSON only, no markdown fences, no preamble, matching exactly this shape:
{"momentum": "<one sentence on development momentum/velocity>", "risks": "<one sentence on operational risk from the tier distribution>", "hygiene": "<one sentence on commit message/hygiene quality>", "recommendations": ["<specific actionable tip>", "<specific actionable tip>"]}

Each summary value must be a single concise sentence, executive-report tone, under 25 words.
Each recommendation must be a specific, actionable sentence under 20 words. Provide 2-3 recommendations.`;
}

/** Calls any OpenAI-compatible /chat/completions endpoint with a hard timeout,
 *  so a slow/unreachable provider can never hang the request indefinitely. */
export async function generateExecutiveSummary(
  owner: string,
  repo: string,
  commits: TieredCommit[],
  breakdown: TierBreakdown,
  healthScore: number,
  config: LlmConfig,
  timeoutMs = 20_000
): Promise<ExecutiveSummary> {
  const { baseUrl, model, apiKey } = resolveConfig(config);
  const prompt = buildPrompt(owner, repo, commits, breakdown, healthScore);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 300,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new RepoPulseError(
        "LLM_UPSTREAM_ERROR",
        `LLM provider returned ${res.status}. ${body.slice(0, 200)}`,
        502
      );
    }

    const data = await res.json();
    const raw: string = data?.choices?.[0]?.message?.content ?? "";
    const cleaned = raw.trim().replace(/^```json\s*|\s*```$/g, "");

    try {
      const parsed = JSON.parse(cleaned);
      const recommendations = Array.isArray(parsed.recommendations)
        ? parsed.recommendations.map((r: unknown) => String(r)).slice(0, 3)
        : [];
      return {
        momentum: String(parsed.momentum ?? "Momentum data unavailable."),
        risks: String(parsed.risks ?? "Risk data unavailable."),
        hygiene: String(parsed.hygiene ?? "Hygiene data unavailable."),
        recommendations,
      };
    } catch {
      throw new RepoPulseError("LLM_PARSE_ERROR", "LLM response was not valid JSON.", 502);
    }
  } catch (err) {
    if (err instanceof RepoPulseError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new RepoPulseError("LLM_TIMEOUT", `LLM request timed out after ${timeoutMs / 1000}s.`, 504);
    }
    throw new RepoPulseError("LLM_UNKNOWN_ERROR", "Unexpected error calling the LLM provider.", 502);
  } finally {
    clearTimeout(timer);
  }
}
