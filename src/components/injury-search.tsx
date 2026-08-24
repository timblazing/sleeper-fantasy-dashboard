"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { injuriesHref, MAX_INJURY_SEARCH, type InjuryQuery } from "@/lib/injury-query";

/** The only client component in the injuries filter row, matching src/components/rankings-search.tsx:
 *  the URL stays the single source of truth, and `replace` keeps a history entry per keystroke
 *  out of the back button. */
export function InjurySearch({ leagueId, query }: { leagueId: string; query: InjuryQuery }) {
  const router = useRouter();
  const [value, setValue] = useState(query.search);
  // React's "adjust state when a prop changes" pattern: a navigation that changes the URL
  // search term (the clear-filters link, the back button) re-syncs the input.
  const [synced, setSynced] = useState(query.search);
  if (query.search !== synced) { setSynced(query.search); setValue(query.search); }

  useEffect(() => {
    if (value === query.search) return;
    const timer = setTimeout(() => router.replace(injuriesHref(leagueId, query, { search: value.trim().slice(0, MAX_INJURY_SEARCH) })), 300);
    return () => clearTimeout(timer);
  }, [value, leagueId, query, router]);

  return (
    <div className="relative w-full sm:max-w-64">
      <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input aria-label="Search injured players" className="pl-8" maxLength={MAX_INJURY_SEARCH} onChange={(event) => setValue(event.target.value)} placeholder="Player, team, or injury" spellCheck={false} type="search" value={value} />
    </div>
  );
}
