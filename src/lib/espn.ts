import "server-only";
import { fetchCached } from "@/lib/fetch-cached";
import type { PlayerGame } from "@/lib/types";

const SITE = "https://site.api.espn.com/apis/site/v2/sports/football/nfl";

// Sleeper and ESPN agree on almost every abbreviation. Map the exceptions in both directions rather
// than assuming, and fold stale Sleeper franchise codes onto their current team.
const SLEEPER_TO_ESPN: Record<string, string> = { WAS: "WSH", OAK: "LV", SD: "LAC", STL: "LAR" };
const ESPN_TO_SLEEPER: Record<string, string> = { WSH: "WAS" };

export const toEspnTeam = (team: string) => SLEEPER_TO_ESPN[team] ?? team;
export const toSleeperTeam = (team: string) => ESPN_TO_SLEEPER[team] ?? team;
export const teamLogoUrl = (team: string) => `https://a.espncdn.com/i/teamlogos/nfl/500/${toEspnTeam(team).toLowerCase()}.png`;
export const headshotUrlForEspnId = (espnId: number) => `https://a.espncdn.com/i/headshots/nfl/players/full/${espnId}.png`;

type ScoreboardResponse = {
  events: {
    id: string; date: string; shortName: string;
    status: { type: { state: "pre" | "in" | "post"; shortDetail: string; detail: string } };
    competitions: { competitors: { homeAway: "home" | "away"; score?: string; team: { abbreviation: string } }[] }[];
  }[];
};

export type NflGame = { id: string; kickoff: string; state: "pre" | "in" | "post"; detail: string; home: string; away: string; homeScore: number | null; awayScore: number | null };

/** ESPN's `seasontype`: 1 = preseason, 2 = regular, 3 = postseason. */
export async function getScoreboard(season: string, week: number, seasonType = 2): Promise<NflGame[]> {
  try {
    const data = await fetchCached<ScoreboardResponse>(`${SITE}/scoreboard?dates=${season}&seasontype=${seasonType}&week=${week}`, { ttl: 300 });
    return (data.events ?? []).flatMap((event) => {
      const competitors = event.competitions?.[0]?.competitors ?? [];
      const home = competitors.find((side) => side.homeAway === "home");
      const away = competitors.find((side) => side.homeAway === "away");
      if (!home || !away) return [];
      const score = (value?: string) => (value == null || value === "" ? null : Number(value));
      return [{ id: event.id, kickoff: event.date, state: event.status.type.state, detail: event.status.type.shortDetail, home: toSleeperTeam(home.team.abbreviation), away: toSleeperTeam(away.team.abbreviation), homeScore: score(home.score), awayScore: score(away.score) }];
    });
  } catch {
    // ESPN is undocumented and occasionally unavailable; the roster and matchup views degrade to
    // showing no game context rather than failing.
    return [];
  }
}

/**
 * Which side of the ball each team is on for a week, keyed by Sleeper abbreviation.
 *
 * Sleeper's projection feed names a player's `opponent` but not whether the game is home or away,
 * so a projected line cannot tell "vs" from "@" on its own. ESPN's scoreboard carries `homeAway`
 * for a future week as soon as the schedule is out, which makes this usable during the preseason
 * when `getWeekGamesByTeam` has no live slate to report.
 */
export async function getWeekHomeAwayByTeam(season: string, week: number): Promise<Map<string, boolean>> {
  const games = await getScoreboard(season, week);
  const byTeam = new Map<string, boolean>();
  for (const game of games) {
    byTeam.set(game.home, true);
    byTeam.set(game.away, false);
  }
  return byTeam;
}

/** Sleeper-abbreviation keyed view of a week's slate, including a bye entry for teams not playing. */
export async function getWeekGamesByTeam(season: string, week: number, seasonType = 2): Promise<Map<string, PlayerGame>> {
  const games = await getScoreboard(season, week, seasonType);
  const byTeam = new Map<string, PlayerGame>();
  for (const game of games) {
    byTeam.set(game.home, { opponent: game.away, home: true, kickoff: game.kickoff, state: game.state, detail: game.detail, bye: false });
    byTeam.set(game.away, { opponent: game.home, home: false, kickoff: game.kickoff, state: game.state, detail: game.detail, bye: false });
  }
  return byTeam;
}

