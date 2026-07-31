"use client";

import type { TieredCommit } from "@/lib/heuristic";

const TIER_COLOR: Record<1 | 2 | 3, string> = {
  1: "#4FD1A5",
  2: "#F2B84B",
  3: "#EF6461",
};

interface Props {
  score: number;
  commits: TieredCommit[];
}

/**
 * The signature visual: a "commit pulse" ring. Each tick is one of the
 * actual 20 commits analyzed, oldest to newest going clockwise, colored
 * by its real tier — so the ring itself IS the data, not decoration.
 */
export function HealthGauge({ score, commits }: Props) {
  const size = 260;
  const center = size / 2;
  const outerR = 108;
  const tickLen = 20;
  const n = commits.length || 1;

  // oldest commit first (GitHub returns newest-first)
  const ordered = [...commits].reverse();

  const ticks = ordered.map((c, i) => {
    const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
    const x1 = center + Math.cos(angle) * (outerR - tickLen);
    const y1 = center + Math.sin(angle) * (outerR - tickLen);
    const x2 = center + Math.cos(angle) * outerR;
    const y2 = center + Math.sin(angle) * outerR;
    return { x1, y1, x2, y2, color: TIER_COLOR[c.tier], key: c.sha };
  });

  const scoreColor = score >= 75 ? "#4FD1A5" : score >= 45 ? "#F2B84B" : "#EF6461";

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Repository health score ${score} out of 100`}>
        <circle cx={center} cy={center} r={outerR - tickLen - 6} fill="none" stroke="#232A35" strokeWidth={1} />
        {ticks.map((t) => (
          <line
            key={t.key}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={t.color}
            strokeWidth={3.5}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-display text-5xl font-bold tabular-nums" style={{ color: scoreColor }}>
          {score}
        </span>
        <span className="text-xs uppercase tracking-widest text-muted mt-1">Health Score</span>
      </div>
    </div>
  );
}
