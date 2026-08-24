import { ShieldAlert, ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlayerCliffRisk, PlayerCombine, PlayerContract, PlayerInjuryHistory } from "@/lib/roster-audit";
import { cn } from "@/lib/utils";

/** Severity → text colour. Amber has no semantic token, so it uses the Tailwind pair directly. */
const RISK_TONE: Record<string, string> = {
  low: "text-positive",
  moderate: "text-amber-600 dark:text-amber-500",
  medium: "text-amber-600 dark:text-amber-500",
  high: "text-negative",
  extreme: "text-negative",
};

const SEVERITY_LABEL: Record<string, string> = { mi: "Minor", mo: "Moderate", ma: "Major", se: "Severe" };

/**
 * Age-cliff risk.
 *
 * This is the page's one genuinely predictive verdict, so it renders only from a validated
 * response — never derived from age locally, which was the explicit spec constraint.
 */
export function PlayerCliffRiskCard({ cliffRisk }: { cliffRisk: PlayerCliffRisk | null }) {
  if (!cliffRisk) return null;
  const level = cliffRisk.level.toLowerCase();
  const tone = RISK_TONE[level] ?? RISK_TONE.moderate;
  const Icon = level === "low" ? ShieldCheck : level === "high" || level === "extreme" ? ShieldAlert : TriangleAlert;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className={cn("size-4", tone)} />
          Cliff risk
          <Badge className="ml-1 capitalize" variant="secondary">{cliffRisk.level}</Badge>
        </CardTitle>
        <CardDescription>Risk score {cliffRisk.score} of 100 — the chance production falls off before the value does</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {cliffRisk.recommendation ? <p className="text-sm">{cliffRisk.recommendation}</p> : null}
        {cliffRisk.factors.length ? (
          <ul className="flex flex-col gap-2 border-t pt-3">
            {cliffRisk.factors.map((factor) => (
              <li className="flex gap-2 text-sm" key={factor.factor}>
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", RISK_TONE[factor.severity.toLowerCase()]?.replaceAll("text-", "bg-") ?? "bg-muted-foreground")} />
                <span className="text-muted-foreground">{factor.detail}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}

/** Durability: RosterAudit's health grade plus the actual injury log behind it. */
export function PlayerInjuryCard({ injury }: { injury: PlayerInjuryHistory | null }) {
  if (!injury || (!injury.events.length && !injury.preNfl.length && !injury.grade)) return null;
  const totalMissed = injury.events.reduce((total, event) => total + (event.gamesMissed ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Injury history</CardTitle>
        <CardDescription>
          {injury.events.length ? `${injury.events.length} recorded NFL injuries · ${totalMissed} games missed` : "No recorded NFL injuries"}
        </CardDescription>
        {injury.grade ? (
          <div className="ml-auto flex flex-col items-end">
            <span className="text-[0.7rem] font-medium tracking-wide text-muted-foreground uppercase">Durability</span>
            <span className="font-mono text-2xl leading-none font-semibold">{injury.grade}</span>
          </div>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {injury.events.length ? (
          <ul className="flex flex-col divide-y">
            {injury.events.map((event, index) => (
              <li className="flex flex-col gap-1 py-2.5 first:pt-0 last:pb-0" key={`${event.season}-${event.week}-${index}`}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{event.title}</span>
                  {event.severity ? <Badge variant="outline">{SEVERITY_LABEL[event.severity] ?? event.severity}</Badge> : null}
                  <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
                    {event.season ?? "—"}{event.week ? ` · Wk ${event.week}` : ""}{event.gamesMissed ? ` · ${event.gamesMissed} missed` : " · played through"}
                  </span>
                </div>
                {event.detail ? <p className="text-sm text-muted-foreground">{event.detail}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}
        {injury.preNfl.length ? (
          <div className="border-t pt-3">
            <p className="mb-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">Before the NFL</p>
            {injury.preNfl.map((event, index) => (
              <p className="text-sm text-muted-foreground" key={index}>{event.year ? `${event.year} — ` : ""}{event.description}</p>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

const money = (value: number | null) => {
  if (value == null) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
  return `$${value}`;
};

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("font-mono text-base font-medium tabular-nums", tone)}>{value}</span>
    </div>
  );
}

/**
 * The NFL contract.
 *
 * Dynasty-relevant because a expiring deal is a real risk of a team change, which moves value
 * independently of anything the player does on the field.
 */
export function PlayerContractCard({ contract }: { contract: PlayerContract | null }) {
  if (!contract || (contract.totalValue == null && contract.apy == null)) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Contract
          {contract.isRookieDeal ? <Badge variant="secondary">Rookie deal</Badge> : null}
          {contract.isExpiring ? <Badge variant="destructive">Expiring</Badge> : null}
        </CardTitle>
        <CardDescription>
          {contract.team ? `${contract.team} · ` : ""}{contract.years ? `${contract.years} years` : ""}
          {contract.expiryYear ? ` through ${contract.expiryYear}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total value" value={money(contract.totalValue)} />
        <Stat label="Per year" value={money(contract.apy)} />
        <Stat label="Guaranteed" value={money(contract.guaranteed)} />
        <Stat label="Years left" tone={contract.yearsLeft === 0 ? "text-negative" : undefined} value={contract.yearsLeft == null ? "—" : String(contract.yearsLeft)} />
      </CardContent>
    </Card>
  );
}

/** Draft capital and athletic testing — the prior that still matters most for young players. */
export function PlayerCombineCard({ combine }: { combine: PlayerCombine | null }) {
  if (!combine) return null;
  const measurables = [
    { label: "40 yard", value: combine.forty },
    { label: "Vertical", value: combine.vertical ? `${combine.vertical}"` : null },
    { label: "Broad", value: combine.broadJump ? `${combine.broadJump}"` : null },
    { label: "3 cone", value: combine.cone },
    { label: "Shuttle", value: combine.shuttle },
    { label: "Bench", value: combine.bench },
  ].filter((entry) => entry.value);

  const drafted = combine.draftRound && combine.draftPick ? `Round ${combine.draftRound}, pick ${combine.draftPick}` : null;
  if (!measurables.length && !drafted) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Draft &amp; combine</CardTitle>
        <CardDescription>
          {[combine.season, drafted, combine.draftTeam, combine.school].filter(Boolean).join(" · ") || "Athletic testing"}
        </CardDescription>
      </CardHeader>
      {measurables.length ? (
        <CardContent className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {measurables.map((entry) => <Stat key={entry.label} label={entry.label} value={entry.value as string} />)}
        </CardContent>
      ) : null}
    </Card>
  );
}
