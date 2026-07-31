import { z } from "zod";
import type { CommitStats } from "./heuristic";

export class RepoPulseError extends Error {
  constructor(public code: string, message: string, public status = 400) {
    super(message);
    this.name = "RepoPulseError";
  }
}

const githubUrlSchema = z
  .string()
  .trim()
  .url({ message: "That doesn't look like a valid URL." })
  .refine((url) => {
    try {
      const u = new URL(url);
      return u.hostname === "github.com" || u.hostname === "www.github.com";
    } catch {
      return false;
    }
  }, { message: "Only github.com repository URLs are supported." });

export interface ParsedRepo {
  owner: string;
  repo: string;
}

/** Strict parsing — rejects anything that isn't exactly /owner/repo, blocking
 *  path traversal, query injection, or accidental issue/PR/blob URLs. */
export function parseGithubUrl(rawUrl: string): ParsedRepo {
  const result = githubUrlSchema.safeParse(rawUrl);
  if (!result.success) {
    throw new RepoPulseError("INVALID_URL", result.error.issues[0].message, 400);
  }

  const u = new URL(result.data);
  const segments = u.pathname.split("/").filter(Boolean);

  if (segments.length < 2) {
    throw new RepoPulseError(
      "INVALID_URL",
      "URL must point to a repository, e.g. https://github.com/owner/repo",
      400
    );
  }

  const [owner, repoRaw] = segments;
  const repo = repoRaw.replace(/\.git$/, "");
  const safeSegment = /^[A-Za-z0-9._-]+$/;

  if (!safeSegment.test(owner) || !safeSegment.test(repo)) {
    throw new RepoPulseError("INVALID_URL", "Owner or repo name contains invalid characters.", 400);
  }

  return { owner, repo };
}

const GITHUB_API = "https://api.github.com";

function authHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function githubFetch(path: string): Promise<Response> {
  const res = await fetch(`${GITHUB_API}${path}`, { headers: authHeaders(), cache: "no-store" });

  if (res.status === 404) {
    throw new RepoPulseError(
      "NOT_FOUND",
      "Repository not found. It may be private, renamed, or misspelled.",
      404
    );
  }
  if (res.status === 403) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      const resetHeader = res.headers.get("x-ratelimit-reset");
      const resetDate = resetHeader ? new Date(Number(resetHeader) * 1000) : null;
      throw new RepoPulseError(
        "RATE_LIMITED",
        `GitHub API rate limit exceeded.${resetDate ? ` Resets at ${resetDate.toLocaleTimeString()}.` : ""} Add a GITHUB_TOKEN to raise the limit.`,
        429
      );
    }
    throw new RepoPulseError("FORBIDDEN", "Access to this repository is forbidden (likely private).", 403);
  }
  if (res.status === 451) {
    throw new RepoPulseError("UNAVAILABLE", "Repository unavailable for legal reasons.", 451);
  }
  if (!res.ok) {
    throw new RepoPulseError("UPSTREAM_ERROR", `GitHub API returned ${res.status}.`, 502);
  }
  return res;
}

interface GithubCommitListItem {
  sha: string;
  commit: { message: string; author: { name: string; date: string } };
}

interface GithubCommitDetail {
  stats?: { additions: number; deletions: number; total: number };
  files?: { filename: string }[];
}

/** Fetch the most recent N commits with full stats. Runs detail fetches
 *  with limited concurrency to stay well under secondary rate limits. */
export async function fetchRecentCommits(
  owner: string,
  repo: string,
  count = 20
): Promise<CommitStats[]> {
  const listRes = await githubFetch(`/repos/${owner}/${repo}/commits?per_page=${count}`);
  const list: GithubCommitListItem[] = await listRes.json();

  if (list.length === 0) {
    throw new RepoPulseError("EMPTY_REPO", "This repository has no commits yet.", 404);
  }

  const CONCURRENCY = 5;
  const results: CommitStats[] = [];

  for (let i = 0; i < list.length; i += CONCURRENCY) {
    const batch = list.slice(i, i + CONCURRENCY);
    const batchResults = await Promise.all(
      batch.map(async (item) => {
        const detailRes = await githubFetch(`/repos/${owner}/${repo}/commits/${item.sha}`);
        const detail: GithubCommitDetail = await detailRes.json();
        const fileNames = (detail.files ?? []).map((f) => f.filename);

        const stat: CommitStats = {
          sha: item.sha,
          shortSha: item.sha.slice(0, 7),
          message: item.commit.message.split("\n")[0],
          author: item.commit.author?.name ?? "unknown",
          date: item.commit.author?.date ?? new Date().toISOString(),
          additions: detail.stats?.additions ?? 0,
          deletions: detail.stats?.deletions ?? 0,
          filesChanged: fileNames.length,
          fileNames,
        };
        return stat;
      })
    );
    results.push(...batchResults);
  }

  return results;
}
