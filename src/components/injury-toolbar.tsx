import Link from "next/link";
import { InjurySearch } from "@/components/injury-search";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { injuriesHref, INJURY_POSITIONS, type InjuryQuery } from "@/lib/injury-query";

const positionLabel = (position: string) => (position === "all" ? "All" : position);

/** The same shape as the Players toolbar (src/components/rankings-toolbar.tsx): the segmented
 *  position filter on the left and search on the right. Every control is a `Link`, so the whole
 *  view is in the URL and nothing here needs client state. */
export function InjuryToolbar({ leagueId, query }: { leagueId: string; query: InjuryQuery }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <ButtonGroup aria-label="Position">
        {INJURY_POSITIONS.map((position) => (
          <Button key={position} nativeButton={false} size="sm" variant={query.position === position ? "default" : "outline"} aria-current={query.position === position ? "page" : undefined} render={<Link href={injuriesHref(leagueId, query, { position })} />}>
            {positionLabel(position)}
          </Button>
        ))}
      </ButtonGroup>
      <div className="flex w-full items-center gap-2 sm:w-auto sm:flex-1 sm:justify-end">
        <InjurySearch leagueId={leagueId} query={query} />
      </div>
    </div>
  );
}
