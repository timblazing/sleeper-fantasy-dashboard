import { CheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { SeasonTimeline } from "@/lib/team-insights";
import { cn } from "@/lib/utils";

/** The season as one rail, so how much runway is left is a glance rather than a calculation. */
export function SeasonTimelineCard({ timeline }: { timeline: SeasonTimeline }) {
  const span = Math.max(1, timeline.endWeek - timeline.startWeek);
  const at = (week: number) => Math.min(100, Math.max(0, ((week - timeline.startWeek) / span) * 100));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Season timeline</CardTitle>
        <CardDescription>
          {timeline.currentWeek === 0 ? timeline.phase.label : `Week ${timeline.currentWeek} of ${timeline.endWeek}`} · {timeline.phase.detail}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div className="relative mx-1.5 mt-3 h-1.5 rounded-full bg-muted">
          <div className="absolute inset-y-0 left-0 rounded-full bg-foreground/60" style={{ width: `${at(timeline.currentWeek)}%` }} />
          {timeline.markers.map((marker) => (
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-card",
                marker.state === "now" ? "bg-foreground" : marker.state === "past" ? "bg-foreground/60" : "bg-muted-foreground/30",
              )}
              key={marker.id}
              style={{ left: `${at(marker.week)}%` }}
            />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {timeline.markers.map((marker) => (
            <div className={cn("rounded-lg p-3 ring-1", marker.state === "now" ? "bg-muted/60 ring-foreground/20" : "bg-muted/30 ring-foreground/5")} key={marker.id}>
              <div className="flex items-start justify-between gap-2">
                <p className={cn("font-medium", marker.state === "past" && "text-muted-foreground")}>{marker.label}</p>
                {marker.state === "now" ? <Badge className="text-[0.6rem]" variant="secondary">Now</Badge> : null}
                {marker.state === "past" ? <CheckIcon className="size-3.5 text-muted-foreground" aria-hidden="true" /> : null}
              </div>
              <p className="mt-1 font-mono text-xs uppercase tracking-wide text-muted-foreground">{marker.week === 0 ? "Current phase" : `Week ${marker.week}`}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
