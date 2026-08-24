import { isLeagueId } from "@/lib/league-id";
import { searchMarketPlayers } from "@/lib/player-market";

export async function GET(request: Request, context: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await context.params;
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  if (!isLeagueId(leagueId)) {
    return Response.json({ error: "Invalid league id." }, { status: 400 });
  }

  if (!query || query.length > 80) {
    return Response.json({ error: "Enter a valid player name." }, { status: 400 });
  }

  try {
    const players = await searchMarketPlayers(leagueId, query);
    return Response.json({ players });
  } catch {
    return Response.json({ error: "Player search is unavailable right now." }, { status: 503 });
  }
}
