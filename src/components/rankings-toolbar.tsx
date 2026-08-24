import Link from "next/link";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { RankingsSearch } from "@/components/rankings-search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { describeAgeRange, rankingsHref, RANKINGS_POSITIONS, type RankingsQuery } from "@/lib/rankings-query";

const positionLabel = (position: string) => (position === "all" ? "All" : position === "picks" ? "Picks" : position === "rookies" ? "Rookies" : position);

/** Every control here is a navigation, not client state: PLAN.md line 64 requires the
 *  filters to be shareable URL state, so the resulting URL is always copy-pasteable.
 *
 *  One row, two clusters: position is the filter people reach for constantly so it stays
 *  segmented and always visible; search is typed rarely but needs its own box. An age range
 *  arriving in the URL still applies and shows as a removable badge below. */
export function RankingsToolbar({ leagueId, query }: { leagueId: string; query: RankingsQuery }) {
  const ageLabel = describeAgeRange(query);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <ButtonGroup aria-label="Position">
          {RANKINGS_POSITIONS.map((position) => (
            <Button key={position} nativeButton={false} size="sm" variant={query.position === position ? "default" : "outline"} aria-current={query.position === position ? "page" : undefined} render={<Link href={rankingsHref(leagueId, query, { position })} />}>
              {positionLabel(position)}
            </Button>
          ))}
        </ButtonGroup>
        <div className="flex w-full items-center gap-2 sm:w-auto sm:flex-1 sm:justify-end">
          <RankingsSearch leagueId={leagueId} query={query} />
        </div>
      </div>
      {ageLabel ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="gap-1 pr-1 font-normal" variant="secondary">
            Age {ageLabel}
            <Button aria-label="Clear age filter" className="size-4 rounded-sm" nativeButton={false} size="icon-xs" variant="ghost" render={<Link href={rankingsHref(leagueId, query, { minAge: undefined, maxAge: undefined })} />}>
              <X aria-hidden="true" />
            </Button>
          </Badge>
        </div>
      ) : null}
    </div>
  );
}

const pageWindow = (page: number, totalPages: number) => {
  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
  return Array.from({ length: Math.min(5, totalPages) }, (_, index) => start + index).filter((candidate) => candidate >= 1 && candidate <= totalPages);
};

/** Lives in the table's CardFooter — the count and the pager belong to the table, not to
 *  the page, and footer-inside-card keeps the reader's eye from leaving the data. */
export function RankingsPagination({ leagueId, query, page, totalPages, totalLabel }: { leagueId: string; query: RankingsQuery; page: number; totalPages: number; totalLabel: string }) {
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted-foreground">{totalLabel}</p>
      {totalPages > 1 ? (
        <nav aria-label="Pagination" className="flex flex-wrap items-center gap-1.5">
          <Button disabled={page <= 1} nativeButton={false} size="sm" variant="outline" render={page <= 1 ? <span /> : <Link href={rankingsHref(leagueId, query, { page: page - 1 })} />}><ChevronLeft data-icon="inline-start" aria-hidden="true" />Prev</Button>
          {pageWindow(page, totalPages).map((candidate) => <Button key={candidate} nativeButton={false} size="sm" variant={candidate === page ? "default" : "ghost"} aria-current={candidate === page ? "page" : undefined} render={<Link href={rankingsHref(leagueId, query, { page: candidate })} />}>{candidate}</Button>)}
          <Button disabled={page >= totalPages} nativeButton={false} size="sm" variant="outline" render={page >= totalPages ? <span /> : <Link href={rankingsHref(leagueId, query, { page: page + 1 })} />}>Next<ChevronRight data-icon="inline-end" aria-hidden="true" /></Button>
        </nav>
      ) : null}
    </div>
  );
}
