import { deriveLeagueFormat } from "@/lib/league-features";
import type { SleeperLeague } from "@/lib/types";
import type { RaPreset } from "@/lib/roster-audit/types";

// League format lives in `league-features.ts`; this is the RosterAudit-facing name for it.
export function derivePresetKey(league: SleeperLeague) {
  return deriveLeagueFormat(league).presetKey;
}

export function clampLeagueSize(numTeams: number | undefined): number {
  return Math.min(16, Math.max(8, numTeams ?? 12));
}

export function resolvePreset(league: SleeperLeague, override?: string, available?: RaPreset[]): RaPreset | null {
  const derivedKey = derivePresetKey(league);
  if (!available || available.length === 0) return null;
  const overrideMatch = override ? available.find((preset) => preset.key === override) : undefined;
  const matched = overrideMatch ?? available.find((preset) => preset.key === derivedKey) ?? null;
  return matched ? { ...matched, leagueSize: clampLeagueSize(league.settings.num_teams) } : null;
}
