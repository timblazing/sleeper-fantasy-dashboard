// The connected account is remembered in a cookie rather than localStorage so `/` can
// redirect on the server, before the connect dialog ever renders. There is no server
// session — `?username=` stays the source of truth once you are inside a league.
import { isLeagueId } from "@/lib/league-id";

export const ACCOUNT_COOKIE = "sleeper_account";

const MAX_AGE = 60 * 60 * 24 * 365;

export type StoredAccount = { username: string; leagueId: string };

/**
 * Parses the cookie value written by `rememberAccount`. Safe on both server and client.
 * This is the only sanctioned reader of `ACCOUNT_COOKIE` — it is what keeps a corrupt or
 * hostile cookie leagueId from ever reaching `src/app/page.tsx`'s server-side `redirect()`.
 */
export function parseStoredAccount(value: string | undefined): StoredAccount | null {
  if (!value) return null;
  try {
    const [username, leagueId] = value.split(":").map(decodeURIComponent);
    return username && leagueId && isLeagueId(leagueId) ? { username, leagueId } : null;
  } catch {
    return null;
  }
}

export function rememberAccount({ leagueId, username }: StoredAccount) {
  const value = `${encodeURIComponent(username)}:${encodeURIComponent(leagueId)}`;
  document.cookie = `${ACCOUNT_COOKIE}=${value}; path=/; max-age=${MAX_AGE}; samesite=lax`;
}

export function forgetAccount() {
  document.cookie = `${ACCOUNT_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

export function readAccountCookie(): StoredAccount | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((entry) => entry.startsWith(`${ACCOUNT_COOKIE}=`));
  return parseStoredAccount(match?.slice(ACCOUNT_COOKIE.length + 1));
}
