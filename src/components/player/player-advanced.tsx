import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { PlayerCareerSeason } from "@/lib/roster-audit";

/**
 * Labels and formatting for the advanced block. Upstream sends bare snake_case keys with no
 * units, so the unit lives here — `rz_target_rate: 11.9` is a percentage while `avg_separation:
 * 3` is yards, and rendering both as raw numbers makes neither legible.
 */
const ADVANCED_LABELS: Record<string, { label: string; unit?: "pct" | "yd"; digits?: number }> = {
  avg_separation: { label: "Separation", unit: "yd", digits: 2 },
  avg_cushion: { label: "Cushion", unit: "yd", digits: 2 },
  catch_percentage: { label: "Catch rate", unit: "pct", digits: 1 },
  avg_yac: { label: "YAC / rec", unit: "yd", digits: 1 },
  avg_yac_above_expectation: { label: "YAC over expected", unit: "yd", digits: 2 },
  percent_share_of_intended_air_yards: { label: "Air yards share", unit: "pct", digits: 1 },
  avg_intended_air_yards_rec: { label: "Intended air yards", unit: "yd", digits: 1 },
  rz_target_rate: { label: "Red zone targets", unit: "pct", digits: 1 },
  rz_carry_rate: { label: "Red zone carries", unit: "pct", digits: 1 },
  deep_target_rate: { label: "Deep target rate", unit: "pct", digits: 1 },
  success_rate: { label: "Success rate", unit: "pct", digits: 1 },
  third_down_rate: { label: "Third down share", unit: "pct", digits: 1 },
  play_action_rate: { label: "Play action rate", unit: "pct", digits: 1 },
  shotgun_rate: { label: "Shotgun rate", unit: "pct", digits: 1 },
  targets_trailing_rate: { label: "Targets when trailing", unit: "pct", digits: 1 },
  targets_leading_rate: { label: "Targets when leading", unit: "pct", digits: 1 },
};

const formatAdvanced = (key: string, value: number) => {
  const spec = ADVANCED_LABELS[key];
  const text = value.toFixed(spec?.digits ?? 1);
  if (spec?.unit === "pct") return `${text}%`;
  if (spec?.unit === "yd") return `${text} yd`;
  return text;
};

/** Next Gen Stats and play-by-play context — the "how he gets his production" block. */
export function PlayerAdvanced({ advanced }: { advanced: Record<string, number | null> }) {
  // A null cell means "not measured for this position", which is not the same as zero, so those
  // keys are dropped rather than rendered as 0.0.
  const entries = Object.entries(advanced).filter((entry): entry is [string, number] => entry[1] != null && ADVANCED_LABELS[entry[0]] !== undefined);
  if (!entries.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Advanced usage</CardTitle>
        <CardDescription>Next Gen Stats and play-by-play context behind the box score</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
        {entries.map(([key, value]) => (
          <div className="flex flex-col gap-0.5" key={key}>
            <span className="truncate text-xs text-muted-foreground">{ADVANCED_LABELS[key].label}</span>
            <span className="font-mono text-lg font-medium tabular-nums">{formatAdvanced(key, value)}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

/** The columns a career table shows, in order, keyed by the position group they matter for. */
const CAREER_COLUMNS: { key: string; label: string; digits?: number }[] = [
  { key: "games_played", label: "G" },
  { key: "completions", label: "Cmp" },
  { key: "attempts", label: "Att" },
  { key: "passing_yards", label: "Pass yd" },
  { key: "passing_tds", label: "Pass TD" },
  { key: "interceptions", label: "INT" },
  { key: "carries", label: "Car" },
  { key: "rushing_yards", label: "Rush yd" },
  { key: "rushing_tds", label: "Rush TD" },
  { key: "targets", label: "Tgt" },
  { key: "receptions", label: "Rec" },
  { key: "receiving_yards", label: "Rec yd" },
  { key: "receiving_tds", label: "Rec TD" },
  { key: "fantasy_points_ppr_total", label: "PPR", digits: 1 },
  { key: "fantasy_points_ppr_avg", label: "PPG", digits: 1 },
];

export function PlayerCareerTable({ career }: { career: PlayerCareerSeason[] }) {
  if (!career.length) return null;

  // A quarterback's career table should not carry eight empty receiving columns, so a column
  // survives only if some season actually has a non-zero value for it.
  const columns = CAREER_COLUMNS.filter((column) => career.some((season) => (season.stats[column.key] ?? 0) !== 0));
  if (!columns.length) return null;

  const seasons = [...career].sort((a, b) => (b.season ?? 0) - (a.season ?? 0));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Career stats</CardTitle>
        <CardDescription>Season by season, newest first</CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Season</TableHead>
              {columns.map((column) => <TableHead className="text-right" key={column.key}>{column.label}</TableHead>)}
            </TableRow>
          </TableHeader>
          <TableBody>
            {seasons.map((season, index) => (
              // Season is the natural key; a row with no season falls back to its index rather
              // than a random one, which would remount the row on every render.
              <TableRow key={season.season ?? `row-${index}`}>
                <TableCell className="font-medium">{season.season ?? "—"}</TableCell>
                {columns.map((column) => {
                  const value = season.stats[column.key];
                  return <TableCell className="text-right font-mono tabular-nums" key={column.key}>{value == null ? "—" : column.digits ? value.toFixed(column.digits) : value.toLocaleString("en-US")}</TableCell>;
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
