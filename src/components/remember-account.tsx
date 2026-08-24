"use client";

import { readAccountCookie, rememberAccount } from "@/lib/account-storage";
import { useSearchParams } from "next/navigation";
import * as React from "react";

// Keeps the remembered account pointed at the league you last opened, so `/` sends
// you back where you were rather than to whichever league Sleeper lists first.
export function RememberAccount({ leagueId }: { leagueId: string }) {
  const username = useSearchParams().get("username")?.trim();

  React.useEffect(() => {
    if (!username) return;
    const stored = readAccountCookie();
    if (stored?.username === username && stored.leagueId === leagueId) return;
    rememberAccount({ leagueId, username });
  }, [leagueId, username]);

  return null;
}
