import { classifyLookupFailure } from "@/lib/account-lookup";
import { getNflLeaguesForUsername } from "@/lib/sleeper";

export async function GET(request: Request) {
  const username = new URL(request.url).searchParams.get("username")?.trim() ?? "";
  if (!username || username.length > 50) {
    return Response.json({ error: "Enter a valid Sleeper username." }, { status: 400 });
  }

  try {
    const account = await getNflLeaguesForUsername(username);
    if (account.leagues.length === 0) {
      return Response.json({ error: `No NFL leagues were found for ${account.username} this season.` }, { status: 404 });
    }
    return Response.json(account);
  } catch (error) {
    const failure = classifyLookupFailure(error);
    return Response.json({ error: failure.error }, { status: failure.status });
  }
}
