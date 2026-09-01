import Link from "next/link";
import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import { PositionBadge } from "@/components/position-badge";
import { TeamLink } from "@/components/team-link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatValue } from "@/lib/display";
import type { PlayerLeagueContext } from "@/lib/player-league-context";
import type { PlayerProfile } from "@/lib/roster-audit";
import { cn, withUsername } from "@/lib/utils";

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();

/** Inches to `6'0"` — upstream sends height as a bare inch count. */
const formatHeight = (inches: number | null) => (inches ? `${Math.floor(inches / 12)}'${inches % 12}"` : null);

function TrendPill({ value, label }: { value: number; label: string }) {
  if (!value) return <span className="text-xs text-muted-foreground">Flat {label}</span>;
  const rising = value > 0;
  const Icon = rising ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium tabular-nums", rising ? "text-positive" : "text-negative")}>
      <Icon className="size-3.5" />
      {rising ? "+" : ""}{Math.round(value).toLocaleString("en-US")}
      <span className="font-normal text-muted-foreground">{label}</span>
    </span>
  );
}

/** One headline number. The label sits above so the eye lands on the figure, not the caption. */
function HeroStat({ label, value, hint, tone }: { label: string; value: string; hint?: string | null; tone?: "primary" }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">{label}</span>
      <span className={cn("font-mono text-2xl leading-none font-semibold tabular-nums", tone === "primary" && "text-primary")}>{value}</span>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

/**
 * The page's identity band: who the player is, what he is worth, and — the part RosterAudit
 * cannot answer — who holds him in *this* league.
 *
 * Superflex leads because the league format drives which value matters; the 1QB figure stays
 * visible as a hint rather than being dropped, since `sf ?? one_qb` is the documented §2.8 bug.
 */
export function PlayerHero({ profile, context, leagueId, isSuperflex, username }: { profile: PlayerProfile; context: PlayerLeagueContext; leagueId: string; isSuperflex: boolean; username?: string }) {
  const { player, value } = profile;
  const primaryValue = isSuperflex ? value.valueSf : value.value1qb;
  const secondaryValue = isSuperflex ? value.value1qb : value.valueSf;
  const rankOverall = isSuperflex ? value.rankOverallSf : value.rankOverall1qb;
  const rankPosition = isSuperflex ? value.rankPositionSf : value.rankPosition1qb;

  const meta = [player.team, player.age ? `${player.age.toFixed(1)}y` : null, player.yearsExp === 0 ? "Rookie" : player.yearsExp ? `${player.yearsExp} yr exp` : null, formatHeight(player.heightInches), player.weightLbs ? `${player.weightLbs} lb` : null, player.college].filter(Boolean).join(" · ");

  return (
    <Card>
      <CardContent className="flex flex-col gap-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <Avatar className="size-16 bg-muted">
              {player.photoUrl ? <AvatarImage alt="" src={player.photoUrl} /> : null}
              <AvatarFallback className="text-lg">{initials(player.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-tight">{player.name}</h1>
                <PositionBadge position={player.position} />
                {value.tierLabel ? <Badge variant="secondary">{value.tierLabel}</Badge> : null}
              </div>
              <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground sm:truncate sm:text-sm">{meta}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Link className={cn(buttonVariants({ variant: "outline", size: "sm" }))} href={withUsername(`/${leagueId}/trade`, username)}>
              Trade calculator <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>

        {/* The number band. Grid rather than flex so the columns line up with the cards below. */}
        <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
          <HeroStat hint={`${isSuperflex ? "1QB" : "SF"} ${formatValue(secondaryValue)}`} label={isSuperflex ? "SF value" : "1QB value"} tone="primary" value={formatValue(primaryValue)} />
          <HeroStat hint={rankPosition ? `${player.position}${rankPosition}` : null} label="Overall" value={rankOverall ? `#${rankOverall}` : "—"} />
          <div className="flex flex-col gap-1">
            <span className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">Momentum</span>
            <TrendPill label="7d" value={value.trend7d} />
            <TrendPill label="30d" value={value.trend30d} />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">In your league</span>
            {context.owner ? (
              <>
                <TeamLink className="truncate text-sm font-medium" leagueId={leagueId} rosterId={context.owner.rosterId} username={username}>{context.owner.teamName}</TeamLink>
                <span className="text-xs text-muted-foreground">{context.owner.isMine ? "Your team" : context.owner.manager}</span>
              </>
            ) : (
              <>
                <span className="text-sm font-medium text-positive">Free agent</span>
                <span className="text-xs text-muted-foreground">Unrostered in this league</span>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
