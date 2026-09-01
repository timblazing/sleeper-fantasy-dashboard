// Pure presentation helpers, safe to import from client components. Nothing here may
// import a module that performs I/O — that is what dragged the Redis SDK and the Sleeper
// fetch layer into the browser bundle when these lived beside their data modules.
import type { NflPlayer, PlayerGame } from "@/lib/types";

export function initials(name: string): string {
  return name.split(/\s|&/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

export function avatarUrl(id: string): string {
  return `https://sleepercdn.com/avatars/thumbs/${id}`;
}

export function headshotUrl(player: Pick<NflPlayer, "id" | "position" | "team">): string {
  return player.position === "DEF" && player.team
    ? `https://sleepercdn.com/images/team_logos/nfl/${player.team.toLowerCase()}.png`
    : `https://sleepercdn.com/content/nfl/players/thumb/${player.id}.jpg`;
}

export function describeGame(game: PlayerGame | null): string {
  if (!game) return "";
  if (game.bye) return "BYE";
  const side = game.home ? "vs" : "@";
  return game.state === "pre" ? `${side} ${game.opponent}` : `${side} ${game.opponent} · ${game.detail}`;
}

export function formatValue(value: number): string {
  if (!value) return "—";
  return value >= 10000 ? `${(value / 1000).toFixed(1)}K` : value.toLocaleString("en-US");
}

export function formatTrend(trend: number): string {
  return `${trend > 0 ? "+" : ""}${Math.round(trend).toLocaleString("en-US")}`;
}
