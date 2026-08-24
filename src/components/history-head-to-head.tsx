import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import type { HeadToHead, ManagerRow } from "@/lib/league-history";
import { cn } from "@/lib/utils";

const shorten = (name: string) => (name.length <= 14 ? name : `${name.slice(0, 13)}…`);

/**
 * The all-time head-to-head grid. Read it horizontally: each row is one team, and each column is
 * that team's record against the opponent named at the top.
 *
 * Cells are tinted by result rather than by margin — the grid is scanned for who owns whom, and a
 * winning record is the only signal that matters at this density.
 */
export function HistoryHeadToHead({ headToHead, managers }: { headToHead: Map<string, HeadToHead>; managers: ManagerRow[] }) {
  // Only managers who actually played — a preseason-only owner would be an empty row and column.
  const teams = managers.filter((row) => row.games > 0);
  if (teams.length < 2) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>All-time head to head</CardTitle>
        <CardDescription>Every regular-season and playoff meeting between the {teams.length} managers who have played</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto">
          <table className="caption-bottom border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 h-auto min-w-[9.5rem] bg-card px-4 pb-2 text-left align-bottom text-xs font-medium text-muted-foreground">Team</th>
                {teams.map((column) => (
                  <th className="h-auto min-w-[3.25rem] px-1 pb-2 align-bottom text-[0.625rem] font-medium leading-tight text-muted-foreground" key={column.ownerId}>
                    <span className="block text-center">{shorten(column.name)}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teams.map((row) => (
                <tr key={row.ownerId}>
                  <td className="sticky left-0 z-10 truncate border-t bg-card px-4 py-1.5 align-middle font-medium">{row.name}</td>
                  {teams.map((column) => {
                    if (row.ownerId === column.ownerId) {
                      // A team has no record against itself; the diagonal is a visual anchor.
                      return <td className="border-t bg-muted/40 px-1 py-1.5 text-center align-middle text-muted-foreground/50" key={column.ownerId}>—</td>;
                    }
                    const cell = headToHead.get(`${row.ownerId}:${column.ownerId}`);
                    if (!cell || cell.wins + cell.losses + cell.ties === 0) {
                      return <td className="border-t px-1 py-1.5 text-center align-middle font-mono text-xs tabular-nums text-muted-foreground/40" key={column.ownerId}>0-0</td>;
                    }
                    const winning = cell.wins > cell.losses;
                    const losing = cell.wins < cell.losses;
                    return (
                      <td
                        className={cn(
                          "border-t px-1 py-1.5 text-center align-middle font-mono text-xs tabular-nums",
                          winning && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                          losing && "bg-destructive/10 text-destructive",
                          !winning && !losing && "text-muted-foreground",
                        )}
                        key={column.ownerId}
                      >
                        {cell.wins}-{cell.losses}{cell.ties ? `-${cell.ties}` : ""}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
      <CardFooter className="border-t pt-3">
        <p className="text-xs text-muted-foreground">Read horizontally — each row shows that team&apos;s record against the opponent in each column.</p>
      </CardFooter>
    </Card>
  );
}
