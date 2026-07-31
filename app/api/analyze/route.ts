import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseGithubUrl, fetchRecentCommits, RepoPulseError } from "@/lib/github";
import { classifyCommit, summarizeTiers, computeHealthScore } from "@/lib/heuristic";
import { generateExecutiveSummary, type LlmProviderPreset } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 45;

const requestSchema = z.object({
  repoUrl: z.string().min(1, "Repository URL is required."),
  llm: z.object({
    preset: z.enum(["groq", "openrouter", "nim", "custom"]),
    baseUrl: z.string().url().optional(),
    apiKey: z.string().optional(),
    model: z.string().optional(),
  }),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "BAD_JSON", message: "Request body must be valid JSON." } }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message ?? "Invalid request." } },
      { status: 400 }
    );
  }

  try {
    const { owner, repo } = parseGithubUrl(parsed.data.repoUrl);
    const rawCommits = await fetchRecentCommits(owner, repo, 20);
    const tieredCommits = rawCommits.map(classifyCommit);
    const breakdown = summarizeTiers(tieredCommits);
    const healthScore = computeHealthScore(tieredCommits);

    let summary;
    try {
      summary = await generateExecutiveSummary(
        owner,
        repo,
        tieredCommits,
        breakdown,
        healthScore,
        parsed.data.llm as { preset: LlmProviderPreset; baseUrl?: string; apiKey?: string; model?: string }
      );
    } catch (llmErr) {
      // Defensive fallback: the deterministic analysis is still valid even if
      // the LLM is down/misconfigured — degrade gracefully instead of failing the whole request.
      const message = llmErr instanceof RepoPulseError ? llmErr.message : "LLM summary unavailable.";
      summary = {
        momentum: `AI summary unavailable (${message}).`,
        risks: "AI summary unavailable — see tier breakdown above for risk signal.",
        hygiene: "AI summary unavailable — see commit list for hygiene detail.",
        recommendations: [],
      };
    }

    return NextResponse.json({
      repo: `${owner}/${repo}`,
      healthScore,
      breakdown,
      commits: tieredCommits,
      summary,
    });
  } catch (err) {
    if (err instanceof RepoPulseError) {
      return NextResponse.json({ error: { code: err.code, message: err.message } }, { status: err.status });
    }
    console.error(err);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Something went wrong analyzing this repository." } },
      { status: 500 }
    );
  }
}
