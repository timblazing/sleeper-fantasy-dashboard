import "server-only";
import { createMemo } from "@/lib/memo";
import type { NflPlayer } from "@/lib/types";

const API = "https://api.sleeper.app/v1";
// Sleeper asks that the full player map be fetched no more than once per day. It is ~15MB of JSON,
// which is far past Next's data-cache entry limit, so it is trimmed and held in module memory here
// rather than going through fetchCached.
const CATALOG_TTL_MS = 12 * 60 * 60 * 1000;

export const NFL_TEAMS: Record<string, string> = {
  ARI: "Cardinals", ATL: "Falcons", BAL: "Ravens", BUF: "Bills", CAR: "Panthers", CHI: "Bears", CIN: "Bengals", CLE: "Browns",
  DAL: "Cowboys", DEN: "Broncos", DET: "Lions", GB: "Packers", HOU: "Texans", IND: "Colts", JAX: "Jaguars", KC: "Chiefs",
  LAC: "Chargers", LAR: "Rams", LV: "Raiders", MIA: "Dolphins", MIN: "Vikings", NE: "Patriots", NO: "Saints", NYG: "Giants",
  NYJ: "Jets", PHI: "Eagles", PIT: "Steelers", SEA: "Seahawks", SF: "49ers", TB: "Buccaneers", TEN: "Titans", WAS: "Commanders",
};

type RawPlayer = {
  full_name?: string; first_name?: string; last_name?: string; position?: string; fantasy_positions?: string[] | null;
  team?: string | null; status?: string | null; injury_status?: string | null; injury_body_part?: string | null;
  practice_participation?: string | null; number?: number | null;
  age?: number | null; years_exp?: number | null; espn_id?: number | null; search_rank?: number | null;
  depth_chart_position?: string | null; depth_chart_order?: number | null; active?: boolean;
};

export function isDefenseId(playerId: string) {
  return /^[A-Z]{2,4}$/.test(playerId);
}

function defensePlayer(id: string): NflPlayer {
  return { id, name: `${NFL_TEAMS[id] ?? id} D/ST`, position: "DEF", team: id, age: null, yearsExp: null, injuryStatus: null, injuryBodyPart: null, practiceParticipation: null, number: null, espnId: null, searchRank: null, depthChartOrder: null, status: null };
}

function trim(id: string, raw: RawPlayer): NflPlayer | null {
  const name = raw.full_name || [raw.first_name, raw.last_name].filter(Boolean).join(" ");
  if (!name) return null;
  const position = raw.position ?? raw.fantasy_positions?.[0] ?? null;
  return {
    id, name, position, team: raw.team ?? null, age: raw.age ?? null, yearsExp: raw.years_exp ?? null,
    injuryStatus: raw.injury_status ?? null, injuryBodyPart: raw.injury_body_part ?? null,
    practiceParticipation: raw.practice_participation ?? null, number: raw.number ?? null, espnId: raw.espn_id ?? null,
    searchRank: raw.search_rank ?? null, depthChartOrder: raw.depth_chart_order ?? null, status: raw.status ?? null,
  };
}

async function loadCatalog(): Promise<Map<string, NflPlayer>> {
  const response = await fetch(`${API}/players/nfl`, { cache: "no-store", headers: { "User-Agent": "Sleeper Fantasy Dashboard/0.1" } });
  if (!response.ok) throw new Error(`Sleeper player map returned ${response.status}`);
  const raw = (await response.json()) as Record<string, RawPlayer>;
  const players = new Map<string, NflPlayer>();
  for (const [id, entry] of Object.entries(raw)) {
    const player = isDefenseId(id) ? defensePlayer(id) : trim(id, entry);
    if (player) players.set(id, player);
  }
  return players;
}

// A second request arriving during the ~2s load awaits the same fetch; a stale catalog beats no
// names at all when Sleeper is briefly unavailable, and with no catalog at all the read must fail.
const catalogMemo = createMemo({ load: loadCatalog, ttlMs: CATALOG_TTL_MS, onError: "throw" });

/** The full Sleeper player map, trimmed to the fields the dashboard renders and cached for 12h. */
export function getPlayerCatalog(): Promise<Map<string, NflPlayer>> {
  return catalogMemo.get("nfl");
}

/** Always returns something renderable: unknown ids become a placeholder rather than a blank row. */
export function resolvePlayer(catalog: Map<string, NflPlayer>, id: string): NflPlayer {
  return catalog.get(id) ?? (isDefenseId(id) ? defensePlayer(id) : { id, name: `Player ${id}`, position: null, team: null, age: null, yearsExp: null, injuryStatus: null, injuryBodyPart: null, practiceParticipation: null, number: null, espnId: null, searchRank: null, depthChartOrder: null, status: null });
}

