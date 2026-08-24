import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PositionRoom } from "@/lib/league-values";
import type { OverviewData } from "@/lib/team-insights";
import { cn } from "@/lib/utils";

/** The four rooms get the same chips they carry everywhere else in the app. */
const POSITION_BAR: Record<string, string> = {
  QB: "bg-position-qb-foreground",
  RB: "bg-position-rb-foreground",
  WR: "bg-position-wr-foreground",
  TE: "bg-position-te-foreground",
};

const RING_SIZE = 104;
const RING_STROKE = 9;
const RADIUS = (RING_SIZE - RING_STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function ordinalSuffix(rank: number): string {
  const tens = rank % 100;
  if (tens >= 11 && tens <= 13) return "th";
  return ["th", "st", "nd", "rd"][rank % 10] ?? "th";
}

/** Top third of the league reads green, the middle amber, the bottom rose — the same tone ladder the insights use. */
function rankTone(rank: number, teams: number) {
  const pct = teams > 1 ? (rank - 1) / (teams - 1) : 0;
  if (pct <= 0.33) return "text-emerald-500";
  if (pct <= 0.66) return "text-amber-500";
  return "text-rose-500";
}

/**
 * League standing as one ring: a full circle is first place, an empty one is last. Reading the
 * arc is faster than reading "#8 of 12", and it sits next to the room ranks that explain it.
 */
function RankRing({ rank, teams }: { rank: number; teams: number }) {
  const share = teams > 1 ? (teams - rank) / (teams - 1) : 1;
  const filled = Math.max(0.04, share);

  return (
    <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
      <svg
        aria-hidden="true"
        className={cn("-rotate-90", rankTone(rank, teams))}
        height={RING_SIZE}
        viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
        width={RING_SIZE}
      >
        <circle
          className="text-muted"
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          fill="none"
          r={RADIUS}
          stroke="currentColor"
          strokeWidth={RING_STROKE}
        />
        <circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          fill="none"
          r={RADIUS}
          stroke="currentColor"
          strokeDasharray={`${CIRCUMFERENCE * filled} ${CIRCUMFERENCE}`}
          strokeLinecap="round"
          strokeWidth={RING_STROKE}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center">
        <span className="flex items-baseline tracking-tight">
          <span className="text-3xl font-bold tabular-nums">{rank}</span>
          <span className="text-sm font-semibold text-muted-foreground">{ordinalSuffix(rank)}</span>
        </span>
      </span>
    </div>
  );
}

/** One room, with the bar length running the other way from the rank: first place fills it. */
function RoomRow({ room, teams }: { room: PositionRoom; teams: number }) {
  const share = teams > 1 ? (teams - room.rank) / (teams - 1) : 1;

  return (
    <div className="flex items-center gap-3">
      <span className="w-7 shrink-0 font-mono text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">{room.position}</span>
      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
        <span
          className={cn("block h-full rounded-full", POSITION_BAR[room.position] ?? "bg-foreground/60")}
          style={{ width: `${Math.max(6, share * 100)}%` }}
        />
      </span>
      <span className="w-9 shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
        {room.rank}{ordinalSuffix(room.rank)}
      </span>
    </div>
  );
}

/**
 * Where the roster ranks overall, and which rooms are carrying or dragging it. The ring is
 * value rank across the league; each bar is that team's rank in one position room.
 */
export function PowerRankingsCard({ data }: { data: OverviewData }) {
  const { outlook, rooms, league } = data;
  if (!outlook) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Power rankings</CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-4 sm:gap-5">
        <RankRing rank={outlook.valueRank} teams={outlook.teams} />
        {rooms.length ? (
          <div className="flex min-w-0 flex-1 flex-col gap-2.5">
            {rooms.map((room) => (
              <RoomRow key={room.position} room={room} teams={outlook.teams} />
            ))}
          </div>
        ) : (
          <p className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
            Position ranks need trade values, which are only published for dynasty leagues.
          </p>
        )}
      </CardContent>
      <CardContent className="text-xs text-muted-foreground">
        <Link className="underline-offset-4 hover:underline" href={`/${league.id}/power-rankings`}>
          {outlook.label} · power #{outlook.powerRank} of {outlook.teams}
        </Link>
      </CardContent>
    </Card>
  );
}
