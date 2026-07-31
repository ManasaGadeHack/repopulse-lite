"use client";

import type { TieredCommit } from "@/lib/heuristic";
import clsx from "clsx";

const TIER_STYLES: Record<1 | 2 | 3, string> = {
  1: "bg-tier1/15 text-tier1 border-tier1/30",
  2: "bg-tier2/15 text-tier2 border-tier2/30",
  3: "bg-tier3/15 text-tier3 border-tier3/30",
};

export function CommitList({ commits }: { commits: TieredCommit[] }) {
  return (
    <div className="flex flex-col divide-y divide-line">
      {commits.map((c) => (
        <div key={c.sha} className="flex items-start gap-3 py-3">
          <span
            className={clsx(
              "shrink-0 mt-0.5 rounded-sm border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wide",
              TIER_STYLES[c.tier]
            )}
          >
            {c.tierLabel}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-ink">{c.message}</p>
            <p className="mt-0.5 text-xs text-muted font-mono">
              {c.shortSha} · {c.author} · +{c.additions}/-{c.deletions} · {c.filesChanged} files
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
