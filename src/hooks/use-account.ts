"use client";

import * as React from "react";
import type { SleeperAccount } from "@/lib/types";

// The sidebar renders from the [leagueId] layout, which cannot read `searchParams`,
// so the connected account is resolved on the client from ?username= instead.
const cache = new Map<string, SleeperAccount>();

export function useAccount(username?: string) {
  const [, loaded] = React.useReducer((count: number) => count + 1, 0);

  React.useEffect(() => {
    if (!username || cache.has(username)) return;
    const controller = new AbortController();
    fetch(`/api/leagues?username=${encodeURIComponent(username)}`, { signal: controller.signal })
      .then((response) => (response.ok ? (response.json() as Promise<SleeperAccount>) : null))
      .then((account) => { if (account) { cache.set(username, account); loaded(); } })
      .catch(() => {});
    return () => controller.abort();
  }, [username]);

  return username ? cache.get(username) : undefined;
}
