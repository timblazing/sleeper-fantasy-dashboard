"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { MAX_RANKINGS_SEARCH, rankingsHref, type RankingsQuery } from "@/lib/rankings-query";

/** The only client component in the rankings filter row. Everything else is a `Link`, so
 *  the URL stays the single source of truth; this input debounces and uses `replace` so
 *  typing does not push a history entry per keystroke. */
export function RankingsSearch({ leagueId, query }: { leagueId: string; query: RankingsQuery }) {
  const router = useRouter();
  const [value, setValue] = useState(query.search);
  // React's "adjust state when a prop changes" pattern: a navigation that changes the URL
  // search term (the clear-filters link, the back button) re-syncs the input.
  const [synced, setSynced] = useState(query.search);
  if (query.search !== synced) { setSynced(query.search); setValue(query.search); }

  useEffect(() => {
    if (value === query.search) return;
    const timer = setTimeout(() => router.replace(rankingsHref(leagueId, query, { search: value.trim().slice(0, MAX_RANKINGS_SEARCH) })), 300);
    return () => clearTimeout(timer);
  }, [value, leagueId, query, router]);

  return (
    <div className="relative w-full sm:max-w-64">
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input aria-label="Search players" className="pl-8" maxLength={MAX_RANKINGS_SEARCH} onChange={(event) => setValue(event.target.value)} placeholder="Search players" spellCheck={false} type="search" value={value} />
    </div>
  );
}
