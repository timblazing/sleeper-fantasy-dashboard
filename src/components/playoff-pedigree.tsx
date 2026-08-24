import { TrophyIcon } from "lucide-react";
import { Attribution } from "@/components/attribution";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlayoffPedigree } from "@/lib/playoff-pedigree";
import { cn } from "@/lib/utils";

const avatarUrl = (id: string) => `https://sleepercdn.com/avatars/thumbs/${id}`;
const initials = (name: string) => name.split(/\s|&/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

/**
 * Career playoff record for the managers still in the league.
 *
 * The odds above are a model; this is the receipts. A manager who has made the bracket every
 * year and gone 0–4 once there reads very differently from one making a first appearance.
 */
export function PlayoffPedigree({ pedigree }: { pedigree: PlayoffPedigree }) {
  if (!pedigree.rows.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Playoff pedigree</CardTitle>
        <CardDescription>
          Career postseason record across {pedigree.seasons} {pedigree.seasons === 1 ? "season" : "seasons"} of league history
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[34rem] text-sm">
            <thead>
              <tr className="border-b text-[0.625rem] font-medium uppercase tracking-wide text-muted-foreground">
                <th className="py-2 pr-2 text-left font-medium">Manager</th>
                <th className="px-2 py-2 text-right font-medium">Seasons</th>
                <th className="px-2 py-2 text-right font-medium">Playoff trips</th>
                <th className="px-2 py-2 text-right font-medium">Playoff record</th>
                <th className="px-2 py-2 text-right font-medium">Titles</th>
                <th className="py-2 pl-2 text-right font-medium">Trophy case</th>
              </tr>
            </thead>
            <tbody>
              {pedigree.rows.map((row) => (
                <tr className={cn("border-b last:border-b-0", row.isUser && "bg-primary/[0.07]")} key={row.userId}>
                  <td className="py-2 pr-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar className="size-6 shrink-0">
                        {row.avatar ? <AvatarImage alt="" src={avatarUrl(row.avatar)} /> : null}
                        <AvatarFallback className="text-[0.5rem]">{initials(row.name)}</AvatarFallback>
                      </Avatar>
                      <span className={cn("truncate text-[0.8125rem]", row.isUser ? "font-semibold text-primary" : "font-medium")}>{row.name}</span>
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs tabular-nums text-muted-foreground">{row.seasons}</td>
                  <td className="px-2 py-2 text-right font-mono text-xs tabular-nums">
                    {row.playoffAppearances}
                    <span className="ml-1 text-[0.625rem] text-muted-foreground">
                      {/* Rate matters more than the count once managers have played unequal seasons. */}
                      {row.seasons ? `${Math.round((row.playoffAppearances / row.seasons) * 100)}%` : "—"}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs tabular-nums">
                    {row.playoffWins}–{row.playoffLosses}
                  </td>
                  <td className="px-2 py-2 text-right font-mono text-xs tabular-nums">{row.championships || <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-2 pl-2 text-right">
                    <span className="inline-flex items-center justify-end gap-1">
                      {Array.from({ length: row.championships }, (_, index) => (
                        <TrophyIcon aria-hidden="true" className="size-3.5 text-primary" key={`title-${index}`} size="14" />
                      ))}
                      {row.runnerUps ? <span className="font-mono text-[0.625rem] text-muted-foreground">{row.runnerUps}× 2nd</span> : null}
                      {!row.championships && !row.runnerUps ? <span className="text-[0.625rem] text-muted-foreground">—</span> : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
      <Attribution text={pedigree.attribution.text} url={pedigree.attribution.url} />
    </Card>
  );
}
