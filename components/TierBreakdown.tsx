"use client";

import type { TierBreakdown as TierBreakdownType } from "@/lib/heuristic";

const ROWS: { key: keyof Omit<TierBreakdownType, "total">; label: string; color: string; desc: string }[] = [
  { key: "tier1", label: "Tier 1 — Low", color: "#4FD1A5", desc: "<50 lines or docs/config only" },
  { key: "tier2", label: "Tier 2 — Medium", color: "#F2B84B", desc: "50–250 lines, <5 files" },
  { key: "tier3", label: "Tier 3 — High", color: "#EF6461", desc: ">250 lines or 5+ files" },
];

export function TierBreakdown({ breakdown }: { breakdown: TierBreakdownType }) {
  return (
    <div className="flex flex-col gap-3">
      {ROWS.map((row) => {
        const count = breakdown[row.key];
        const pct = breakdown.total > 0 ? (count / breakdown.total) * 100 : 0;
        return (
          <div key={row.key} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium text-ink">{row.label}</span>
              <span className="font-mono text-muted">{count} / {breakdown.total}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-surface2 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{ width: `${pct}%`, backgroundColor: row.color }}
              />
            </div>
            <span className="text-xs text-muted">{row.desc}</span>
          </div>
        );
      })}
    </div>
  );
}
