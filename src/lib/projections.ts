import "server-only";
import { createMemo } from "@/lib/memo";

type SleeperProjection = {
  player_id: string;
  stats?: Record<string, number> | null;
  opponent?: string | null;
};

export type WeeklyProjection = { stats: Record<string, number>; opponent: string | null };

const API = "https://api.sleeper.com";
const CACHE_TTL_MS = 30 * 60 * 1000;

/** The memo is keyed by `${season}:${week}`, which this parses back into the two request parameters. */
async function loadWeeklyProjections(key: string): Promise<Map<string, WeeklyProjection>> {
  const [season, week] = key.split(":");
  const response = await fetch(`${API}/projections/nfl/${season}/${week}?season_type=regular`, {
    cache: "no-store",
    headers: { "User-Agent": "Sleeper Fantasy Dashboard/0.1" },
  });
  if (!response.ok) throw new Error(`Sleeper projections returned ${response.status}`);
  const rows = (await response.json()) as SleeperProjection[];
  return new Map(rows.flatMap((row) => row.stats ? [[row.player_id, { stats: row.stats, opponent: row.opponent ?? null }] as const] : []));
}

// Sleeper's undocumented projection feed is large, so one week is kept in process memory rather
// than going through the data cache. Projections are decoration: a failed load degrades to none.
const projectionMemo = createMemo({ load: loadWeeklyProjections, ttlMs: CACHE_TTL_MS, onError: () => new Map<string, WeeklyProjection>() });

export function getWeeklyProjections(season: string, week: number) {
  return projectionMemo.get(`${season}:${week}`);
}

export function scoreProjection(stats: Record<string, number> | undefined, scoring: Record<string, number>) {
  if (!stats) return null;
  const total = Object.entries(scoring).reduce((sum, [key, multiplier]) => sum + (stats[key] ?? 0) * multiplier, 0);
  return Number.isFinite(total) ? Math.max(0, total) : null;
}

function normalCdf(value: number) {
  const sign = value < 0 ? -1 : 1;
  const x = Math.abs(value) / Math.sqrt(2);
  const t = 1 / (1 + 0.3275911 * x);
  const erf = sign * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x));
  return (1 + erf) / 2;
}

/** A transparent estimate, not a sportsbook line: projected-score edge with 28% team variance. */
export function projectedWinProbability(home: number, away: number) {
  const uncertainty = Math.max(12, 0.28 * Math.hypot(home, away));
  const probability = normalCdf((home - away) / uncertainty);
  return Math.round(Math.min(0.97, Math.max(0.03, probability)) * 100);
}
