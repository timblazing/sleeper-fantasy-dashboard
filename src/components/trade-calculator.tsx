"use client";

import * as React from "react";
import { ArrowUpDownIcon, LoaderCircleIcon, SearchIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { PositionBadge } from "@/components/position-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { headshotUrl } from "@/lib/display";
import type { MarketPlayer } from "@/lib/player-market";
import type { RaTrade, TradeAssetInput } from "@/lib/roster-audit";
import type { PickOption, TradeLabData, TradePlayer } from "@/lib/trade-lab";
import { cn } from "@/lib/utils";

/** One asset staged on a side. `key` is what the UI dedupes and removes by. */
type StagedAsset = { key: string; name: string; detail: string; position?: string | null; imageUrl?: string; value: number; input: TradeAssetInput };

type CalculateResponse = { trade?: RaTrade; error?: string };

const formatter = new Intl.NumberFormat("en-US");
const ANY_TEAM = "any";
const SUGGESTION_LIMIT = 8;

const playerAsset = (player: TradePlayer | MarketPlayer["player"] & { value?: number }, value: number): StagedAsset => ({
  key: `player:${player.id}`,
  name: player.name,
  detail: [player.team ?? "FA", player.age ? `${player.age} yrs` : null].filter(Boolean).join(" · "),
  position: player.position,
  imageUrl: headshotUrl(player),
  value,
  input: { type: "player", id: player.id },
});

const pickAsset = (pick: PickOption): StagedAsset => ({
  key: `pick:${pick.season}:${pick.round}:${pick.slot}`,
  name: pick.label,
  detail: `${pick.season} draft pick`,
  value: pick.value,
  input: { type: "pick", season: pick.season, round: pick.round, slot: pick.slot },
});

const gradeTone = (grade: string) => grade.startsWith("A") || grade.startsWith("B")
  ? "border-positive/30 bg-positive/10 text-positive"
  : grade.startsWith("C")
    ? "border-warning/30 bg-warning/10 text-warning"
    : "border-negative/30 bg-negative/10 text-negative";

function TeamSelect({ label, teams, value, onChange }: { label: string; teams: TradeLabData["teams"]; value: string; onChange: (value: string) => void }) {
  return <Select value={value} onValueChange={(next) => { if (next) onChange(next); }}>
    {/* Base UI renders the raw value unless the label is resolved here, and roster ids are not names. */}
    <SelectTrigger aria-label={label} className="w-full" size="sm"><SelectValue>{(selected) => selected === ANY_TEAM ? "Any player (hypothetical)" : teams.find((team) => String(team.rosterId) === selected)?.name ?? "Select a team"}</SelectValue></SelectTrigger>
    <SelectContent>
      <SelectItem value={ANY_TEAM}>Any player (hypothetical)</SelectItem>
      {teams.map((team) => <SelectItem key={team.rosterId} value={String(team.rosterId)}>{team.name}</SelectItem>)}
    </SelectContent>
  </Select>;
}

function AssetAvatar({ asset }: { asset: Pick<StagedAsset, "imageUrl" | "name" | "position"> }) {
  return <Avatar className="size-9 bg-muted">
    {asset.imageUrl ? <AvatarImage alt="" src={asset.imageUrl} /> : null}
    <AvatarFallback className="text-[0.65rem] font-medium">{asset.position ?? "PK"}</AvatarFallback>
  </Avatar>;
}

function SuggestionRow({ asset, onAdd }: { asset: StagedAsset; onAdd: () => void }) {
  return <Button className="h-auto w-full justify-start gap-3 rounded-none px-4 py-2.5 text-left whitespace-normal" onClick={onAdd} variant="ghost">
    <AssetAvatar asset={asset} />
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-1.5 font-medium"><span className="truncate">{asset.name}</span>{asset.position ? <PositionBadge position={asset.position} /> : null}</span>
      <span className="block truncate text-xs font-normal text-muted-foreground">{asset.detail}</span>
    </span>
    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{asset.value ? formatter.format(asset.value) : "—"}</span>
  </Button>;
}

function StagedRow({ asset, onRemove }: { asset: StagedAsset; onRemove: () => void }) {
  return <div className="flex items-center gap-3 px-4 py-2.5">
    <AssetAvatar asset={asset} />
    <span className="min-w-0 flex-1">
      <span className="flex items-center gap-1.5 font-medium"><span className="truncate">{asset.name}</span>{asset.position ? <PositionBadge position={asset.position} /> : null}</span>
      <span className="block truncate text-xs text-muted-foreground">{asset.detail}</span>
    </span>
    <span className="font-mono text-sm tabular-nums">{asset.value ? formatter.format(asset.value) : "—"}</span>
    <Button aria-label={`Remove ${asset.name}`} className="size-7" onClick={onRemove} size="icon" variant="ghost"><XIcon className="size-4" /></Button>
  </div>;
}

function Side({ data, title, description, teamId, onTeamChange, assets, onAdd, onRemove }: {
  data: TradeLabData;
  title: string;
  description: string;
  teamId: string;
  onTeamChange: (value: string) => void;
  assets: StagedAsset[];
  onAdd: (asset: StagedAsset) => void;
  onRemove: (key: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [remote, setRemote] = React.useState<MarketPlayer[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const trimmed = query.trim();
  const roster = teamId === ANY_TEAM ? null : data.teams.find((team) => String(team.rosterId) === teamId) ?? null;
  const staged = new Set(assets.map((asset) => asset.key));

  // Roster mode filters a list we already hold; hypothetical mode has to ask the server,
  // which is also the only path that can reach players nobody in the league rosters.
  React.useEffect(() => {
    if (roster || !trimmed) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/leagues/${data.league.id}/players?q=${encodeURIComponent(trimmed)}`, { signal: controller.signal });
        const payload = await response.json() as { players?: MarketPlayer[] };
        setRemote(response.ok ? payload.players ?? [] : []);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRemote([]);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, 150);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [data.league.id, roster, trimmed]);

  const playerSuggestions: StagedAsset[] = roster
    ? roster.players.filter((player) => player.name.toLowerCase().includes(trimmed.toLowerCase())).map((player) => playerAsset(player, player.value))
    : trimmed ? remote.map((entry) => playerAsset(entry.player, entry.value)) : [];
  const pickSuggestions = data.picks.filter((pick) => !trimmed || pick.label.toLowerCase().includes(trimmed.toLowerCase())).map(pickAsset);
  const suggestions = [...playerSuggestions, ...(trimmed ? pickSuggestions : pickSuggestions.slice(0, 3))].filter((asset) => !staged.has(asset.key)).slice(0, SUGGESTION_LIMIT);
  const total = assets.reduce((sum, asset) => sum + asset.value, 0);

  return <Card className="flex flex-col">
    <CardHeader>
      <CardTitle>{title}</CardTitle>
      <CardDescription>{description}</CardDescription>
      <div className="mt-3"><TeamSelect label={`${title} — team`} onChange={onTeamChange} teams={data.teams} value={teamId} /></div>
    </CardHeader>
    <CardContent className="flex flex-1 flex-col gap-4">
      <div className="overflow-hidden rounded-xl border">
        {assets.length
          ? <div className="divide-y">{assets.map((asset) => <StagedRow asset={asset} key={asset.key} onRemove={() => onRemove(asset.key)} />)}</div>
          : <p className="px-4 py-6 text-center text-sm text-muted-foreground">No assets yet. Add players or picks below.</p>}
        {assets.length ? <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2 text-sm">
          <span className="text-muted-foreground">Market value</span>
          <span className="font-mono font-medium tabular-nums">{formatter.format(total)}</span>
        </div> : null}
      </div>

      <div className="relative">
        <SearchIcon aria-hidden="true" className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input aria-label={`Add an asset to ${title}`} className="h-10 pl-8" onChange={(event) => { const value = event.target.value; setQuery(value); setIsSearching(!roster && Boolean(value.trim())); }} placeholder={roster ? `Search ${roster.name} and picks...` : "Search any player or pick..."} type="search" value={query} />
      </div>

      <div aria-busy={isSearching} className="overflow-hidden rounded-xl border">
        {suggestions.length
          ? <div className="divide-y">{suggestions.map((asset) => <SuggestionRow asset={asset} key={asset.key} onAdd={() => { onAdd(asset); setQuery(""); }} />)}</div>
          : <p className="px-4 py-6 text-center text-sm text-muted-foreground">{isSearching ? "Searching..." : trimmed ? "No players or picks matched." : "Start typing to find a player."}</p>}
      </div>
    </CardContent>
  </Card>;
}

function Verdict({ trade }: { trade: RaTrade }) {
  const winnerLabel = trade.verdict.winner === null ? "Even trade" : trade.verdict.winner === "sideA" ? "You win this trade" : "Your partner wins this trade";
  const total = trade.sideA.value + trade.sideB.value;
  const sharePercent = total ? Math.round((trade.sideA.value / total) * 100) : 50;

  return <Card>
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><CardTitle>{winnerLabel}</CardTitle><CardDescription>{trade.verdict.difference ? `${formatter.format(trade.verdict.difference)} value gap` : "Both sides carry the same market value"}</CardDescription></div>
        <Badge className={cn("text-base", gradeTone(trade.verdict.grade))} variant="outline">{trade.verdict.grade}</Badge>
      </div>
    </CardHeader>
    <CardContent className="flex flex-col gap-5">
      <div>
        <div className="flex justify-between text-sm"><span className="font-medium">You receive {formatter.format(trade.sideA.value)}</span><span className="font-medium">{formatter.format(trade.sideB.value)} you send</span></div>
        <div className="mt-2 flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label={`You receive ${sharePercent}% of the traded value`}>
          <div className="bg-positive" style={{ width: `${sharePercent}%` }} />
          <div className="flex-1 bg-primary/60" />
        </div>
      </div>

      {trade.cliffWarnings.length ? <div className="flex flex-col gap-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Age and decline risk</p>
        {trade.cliffWarnings.map((warning) => <div className="rounded-xl border p-4" key={`${warning.sleeperId}-${warning.side}`}>
          <div className="flex flex-wrap items-center gap-2">
            <TriangleAlertIcon className="size-4 text-warning" />
            <span className="font-medium">{warning.name}</span>
            <PositionBadge position={warning.position} />
            <Badge variant="secondary">{warning.riskLevel} risk</Badge>
            <span className="text-xs text-muted-foreground">{warning.side === "acquiring" ? "You would acquire" : "You would send"}</span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">{warning.summary}</p>
          {warning.factors.length ? <ul className="mt-2 flex flex-col gap-1">{warning.factors.map((factor) => <li className="text-xs text-muted-foreground" key={factor.factor}>· {factor.detail}</li>)}</ul> : null}
        </div>)}
      </div> : null}
    </CardContent>
  </Card>;
}

export function TradeCalculator({ data }: { data: TradeLabData }) {
  const myTeam = data.teams.find((team) => team.rosterId === data.myRosterId);
  const partnerDefault = data.teams.find((team) => team.rosterId !== data.myRosterId);
  const [receiveTeam, setReceiveTeam] = React.useState(partnerDefault ? String(partnerDefault.rosterId) : ANY_TEAM);
  const [sendTeam, setSendTeam] = React.useState(myTeam ? String(myTeam.rosterId) : ANY_TEAM);
  const [receive, setReceive] = React.useState<StagedAsset[]>([]);
  const [send, setSend] = React.useState<StagedAsset[]>([]);
  const [trade, setTrade] = React.useState<RaTrade | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isCalculating, setIsCalculating] = React.useState(false);

  const hasAssets = receive.length > 0 || send.length > 0;
  const ready = receive.length > 0 && send.length > 0;
  const add = (setter: React.Dispatch<React.SetStateAction<StagedAsset[]>>) => (asset: StagedAsset) => {
    setter((current) => current.some((entry) => entry.key === asset.key) ? current : [...current, asset]);
    setTrade(null);
    setError(null);
    setIsCalculating(false);
  };
  const remove = (setter: React.Dispatch<React.SetStateAction<StagedAsset[]>>) => (key: string) => {
    setter((current) => current.filter((entry) => entry.key !== key));
    setTrade(null);
    setError(null);
    setIsCalculating(false);
  };
  const swap = () => {
    setReceive(send); setSend(receive);
    setReceiveTeam(sendTeam); setSendTeam(receiveTeam);
    setTrade(null);
    setError(null);
    setIsCalculating(false);
  };
  const clear = () => { setReceive([]); setSend([]); setTrade(null); setError(null); setIsCalculating(false); };

  // Wait for a short pause after each edit, then cancel any obsolete request. This keeps the
  // calculator feeling live without spending the upstream rate limit on rapid add/remove clicks.
  React.useEffect(() => {
    if (!ready) return;

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setIsCalculating(true);
      try {
        const response = await fetch("/api/roster-audit/trade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ leagueId: data.league.id, sideA: receive.map((asset) => asset.input), sideB: send.map((asset) => asset.input) }),
          signal: controller.signal,
        });
        const payload = await response.json() as CalculateResponse;
        if (!response.ok || !payload.trade) throw new Error(payload.error ?? "The trade could not be calculated.");
        setTrade(payload.trade);
      } catch (requestError) {
        if (requestError instanceof DOMException && requestError.name === "AbortError") return;
        setTrade(null);
        setError(requestError instanceof Error ? requestError.message : "The trade could not be calculated.");
      } finally {
        if (!controller.signal.aborted) setIsCalculating(false);
      }
    }, 350);

    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [data.league.id, ready, receive, send]);

  return <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8">
    <PageHeader description="Stage both sides of a deal and grade it against live market values." title="Trade Calculator" />

    {!data.valuesReady ? <Card><CardContent className="py-4 text-sm text-muted-foreground">Live market values are unavailable right now, so staged assets may show no value. The graded result still comes from RosterAudit.</CardContent></Card> : null}

    {hasAssets && trade ? <Verdict trade={trade} /> : null}

    <div className="grid gap-4 lg:grid-cols-2">
      <Side assets={receive} data={data} description="Assets coming to your roster" onAdd={add(setReceive)} onRemove={remove(setReceive)} onTeamChange={setReceiveTeam} teamId={receiveTeam} title="You receive" />
      <Side assets={send} data={data} description="Assets leaving your roster" onAdd={add(setSend)} onRemove={remove(setSend)} onTeamChange={setSendTeam} teamId={sendTeam} title="You send" />
    </div>

    {hasAssets ? <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 shadow-xs">
      <Button onClick={swap} size="sm" variant="outline"><ArrowUpDownIcon className="size-4" />Swap sides</Button>
      <Button onClick={clear} size="sm" variant="ghost">Clear</Button>
      <span aria-live="polite" className="ml-1 inline-flex items-center gap-2 text-sm text-muted-foreground sm:ml-auto">
        {isCalculating ? <><LoaderCircleIcon className="size-4 animate-spin" />Updating trade value...</> : ready ? "Updates automatically as you edit." : "Add at least one asset to each side."}
      </span>
    </div> : null}

    {hasAssets && error ? <Card><CardContent className="flex items-start gap-3 py-4 text-sm"><TriangleAlertIcon className="mt-0.5 size-4 shrink-0 text-destructive" /><span>{error}</span></CardContent></Card> : null}
  </div>;
}
