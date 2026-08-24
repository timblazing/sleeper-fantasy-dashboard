import { HttpError } from "@/lib/fetch-cached";

export type LookupFailure = { status: number; error: string };

const NOT_FOUND: LookupFailure = { status: 404, error: "We couldn't find that Sleeper username. Check the spelling and try again." };
const UNAVAILABLE: LookupFailure = { status: 503, error: "Sleeper is unavailable right now. This isn't your username — try again in a few minutes." };

/**
 * Maps whatever `getNflLeaguesForUsername` threw to the HTTP status and user-facing message
 * the route should return. `HttpError` branches must come before the message-matching branches
 * below — `HttpError` extends `Error`, so a message check placed first would shadow them.
 */
export function classifyLookupFailure(error: unknown): LookupFailure {
  if (error instanceof HttpError) {
    if (error.status === 429) {
      return { status: 429, error: "Sleeper is rate limiting us right now. Wait a moment and try again." };
    }
    if (error.status >= 500) return UNAVAILABLE;
    if (error.status === 404) return NOT_FOUND;
    return { status: 502, error: "Sleeper returned an unexpected response. Try again in a few minutes." };
  }

  if (error instanceof Error && error.message === "Sleeper user not found") return NOT_FOUND;
  if (error instanceof Error && error.message === "The current NFL season is unavailable") return UNAVAILABLE;

  return { status: 502, error: "We couldn't reach Sleeper. Check your connection and try again." };
}
