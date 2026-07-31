/**
 * RepoPulse Lite — Deterministic Complexity Heuristic
 *
 * This runs BEFORE any LLM call. It must be pure, deterministic, and
 * side-effect free so the same commit always yields the same tier —
 * the LLM only narrates what this engine already decided.
 *
 * Tiering rules (per assignment spec):
 *  - Tier 1 (Low):    < 50 total lines changed, OR touches only docs/config files
 *  - Tier 2 (Medium):  50-250 lines changed AND fewer than 5 files touched
 *  - Tier 3 (High):   > 250 lines changed OR 5+ files touched
 */

export type Tier = 1 | 2 | 3;

export interface CommitStats {
  sha: string;
  shortSha: string;
  message: string;
  author: string;
  date: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  fileNames: string[];
}

export interface TieredCommit extends CommitStats {
  tier: Tier;
  tierLabel: "Low" | "Medium" | "High";
  totalLines: number;
  reason: string;
}

const DOC_CONFIG_EXTENSIONS = [
  ".md", ".mdx", ".txt", ".rst",
  ".json", ".yml", ".yaml", ".toml", ".lock",
  ".gitignore", ".env.example", ".editorconfig",
];

function isDocOrConfigOnly(fileNames: string[]): boolean {
  if (fileNames.length === 0) return false;
  return fileNames.every((f) => {
    const lower = f.toLowerCase();
    return DOC_CONFIG_EXTENSIONS.some((ext) => lower.endsWith(ext)) ||
      lower.includes("readme") || lower.includes("docs/") || lower.includes("changelog");
  });
}

export function classifyCommit(stats: CommitStats): TieredCommit {
  const totalLines = stats.additions + stats.deletions;
  const docOnly = isDocOrConfigOnly(stats.fileNames);

  let tier: Tier;
  let reason: string;

  if (totalLines > 250 || stats.filesChanged >= 5) {
    tier = 3;
    reason = totalLines > 250
      ? `${totalLines} lines changed exceeds the 250-line high-complexity threshold`
      : `${stats.filesChanged} files touched meets/exceeds the 5-file threshold`;
  } else if (totalLines < 50 || docOnly) {
    tier = 1;
    reason = docOnly
      ? "Touches only documentation/config files"
      : `${totalLines} lines changed is below the 50-line low-complexity threshold`;
  } else {
    tier = 2;
    reason = `${totalLines} lines across ${stats.filesChanged} files falls in the medium band`;
  }

  const tierLabel = tier === 1 ? "Low" : tier === 2 ? "Medium" : "High";
  return { ...stats, tier, tierLabel, totalLines, reason };
}

export interface TierBreakdown {
  tier1: number;
  tier2: number;
  tier3: number;
  total: number;
}

export function summarizeTiers(commits: TieredCommit[]): TierBreakdown {
  return {
    tier1: commits.filter((c) => c.tier === 1).length,
    tier2: commits.filter((c) => c.tier === 2).length,
    tier3: commits.filter((c) => c.tier === 3).length,
    total: commits.length,
  };
}

/**
 * Repository Health Score (0-100)
 *
 * Weighted composite:
 *  - 50%  commit size discipline (favors Tier 1/2 over Tier 3 dominance)
 *  - 25%  commit message hygiene (conventional-commit prefix detection)
 *  - 25%  cadence consistency (penalizes huge single-day dumps vs spread activity)
 */
export function computeHealthScore(commits: TieredCommit[]): number {
  if (commits.length === 0) return 0;

  const breakdown = summarizeTiers(commits);
  const sizeScore =
    (breakdown.tier1 * 1.0 + breakdown.tier2 * 0.6 + breakdown.tier3 * 0.15) /
    breakdown.total;

  const conventionalPattern = /^(feat|fix|docs|refactor|test|chore|style|perf|build|ci)(\(.+\))?:/i;
  const hygieneScore =
    commits.filter((c) => conventionalPattern.test(c.message.trim())).length /
    commits.length;

  const uniqueDays = new Set(commits.map((c) => c.date.slice(0, 10))).size;
  const cadenceScore = Math.min(1, uniqueDays / Math.min(5, commits.length));

  const composite =
    sizeScore * 0.5 + hygieneScore * 0.25 + cadenceScore * 0.25;

  return Math.round(composite * 100);
}
