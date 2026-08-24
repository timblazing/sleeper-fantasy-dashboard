"use client";

import { PlayerAdvanced, PlayerCareerTable } from "@/components/player/player-advanced";
import { PlayerHero } from "@/components/player/player-hero";
import { PlayerTradeMarketCard, PlayerRelatedCards } from "@/components/player/player-market";
import { PlayerPercentiles } from "@/components/player/player-percentiles";
import { PlayerCliffRiskCard, PlayerCombineCard, PlayerContractCard, PlayerInjuryCard } from "@/components/player/player-profile-cards";
import { PlayerProjection } from "@/components/player/player-projection";
import { PlayerSnapTrend } from "@/components/player/player-usage";
import { PlayerValueChart } from "@/components/player/player-value-chart";
import { PlayerWeeklyChart } from "@/components/player/player-weekly-chart";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { PlayerLeagueContext } from "@/lib/player-league-context";
import type { PlayerProfile } from "@/lib/roster-audit";

/** A tab with nothing behind it is worse than no tab, so each renders its own empty state. */
function TabEmpty({ title, description }: { title: string; description: string }) {
  return (
    <Empty className="min-h-48 border">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

/**
 * The player page body.
 *
 * The always-visible block answers "what is he worth and is he trending" — the question that
 * brought the reader here. Everything that supports or complicates that answer lives behind a
 * tab, so a deep payload does not become a page nobody scrolls to the bottom of.
 */
export function PlayerDetail({ profile, context, leagueId, isSuperflex, username }: { profile: PlayerProfile; context: PlayerLeagueContext; leagueId: string; isSuperflex: boolean; username?: string }) {
  const hasProduction = profile.weekly.length > 1 || profile.career.length > 0 || Object.keys(profile.advanced).length > 0;
  const hasProfileTab = Boolean(profile.injury || profile.contract || profile.combine || profile.cliffRisk);
  const hasMarket = Boolean(profile.tradeMarket?.trades.length || profile.related);

  return (
    <div className="flex flex-col gap-4">
      <PlayerHero context={context} isSuperflex={isSuperflex} leagueId={leagueId} profile={profile} username={username} />

      <PlayerValueChart history={profile.history} isSuperflex={isSuperflex} valueHistory={profile.valueHistory} />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="production">Production</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="market">Market</TabsTrigger>
        </TabsList>

        <TabsContent className="flex flex-col gap-4" value="overview">
          <PlayerPercentiles metrics={profile.rankMetrics} position={profile.player.position} season={profile.rankSeason ?? profile.season} />
          <PlayerProjection curve={profile.projectionCurve} outcome={profile.outcome} ppg={profile.projectedPpg} ppgPpr={profile.projectedPpgPpr} summary={profile.projectionSummary} />
          {!profile.rankMetrics.length && !profile.projectionCurve.length && !profile.projectionSummary ? (
            <TabEmpty description="RosterAudit has no season rankings or projection for this player yet." title="No projection data" />
          ) : null}
        </TabsContent>

        <TabsContent className="flex flex-col gap-4" value="production">
          {hasProduction ? (
            <>
              <PlayerWeeklyChart season={profile.season} weekly={profile.weekly} />
              <PlayerSnapTrend avgSnapPct={profile.avgSnapPct} snaps={profile.snapsWeekly} />
              <PlayerAdvanced advanced={profile.advanced} />
              <PlayerCareerTable career={profile.career} />
            </>
          ) : (
            <TabEmpty description="No games played yet — production data appears once the player takes the field." title="No production data" />
          )}
        </TabsContent>

        <TabsContent className="flex flex-col gap-4" value="profile">
          {hasProfileTab ? (
            <>
              <PlayerCliffRiskCard cliffRisk={profile.cliffRisk} />
              <PlayerInjuryCard injury={profile.injury} />
              <PlayerContractCard contract={profile.contract} />
              <PlayerCombineCard combine={profile.combine} />
            </>
          ) : (
            <TabEmpty description="No injury history, contract, or combine data is available for this player." title="No profile data" />
          )}
        </TabsContent>

        <TabsContent className="flex flex-col gap-4" value="market">
          {hasMarket ? (
            <>
              <PlayerTradeMarketCard market={profile.tradeMarket} />
              <PlayerRelatedCards leagueId={leagueId} related={profile.related} username={username} />
            </>
          ) : (
            <TabEmpty description="No recorded trades or comparable players for this player yet." title="No market data" />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
