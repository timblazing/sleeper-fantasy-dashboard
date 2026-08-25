"use client";

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const formatter = new Intl.NumberFormat("en-US");

export const signed = (value: number) => `${value > 0 ? "+" : ""}${formatter.format(Math.round(value))}`;
export const plain = (value: number) => formatter.format(Math.round(value));

/**
 * Result color for a surplus number.
 *
 * `--positive`/`--negative` rather than literal emerald/red so a theme change moves these with
 * everything else that means "good" or "bad" in the app.
 */
export const valueTone = (value: number) => (value > 0 ? "text-positive" : value < 0 ? "text-negative" : "text-muted-foreground");

/**
 * Letter grade → chip color, banded rather than per-letter.
 *
 * A/B read positive, C neutral, D/F negative, so the leaderboard scans by color alone without
 * inventing eleven separate hues for eleven grades.
 */
export function gradeTone(grade: string) {
  if (grade.startsWith("A")) return "border-transparent bg-positive/15 text-positive";
  if (grade.startsWith("B")) return "border-transparent bg-positive/10 text-positive";
  if (grade.startsWith("C")) return "border-transparent bg-warning/15 text-warning";
  return "border-transparent bg-negative/15 text-negative";
}

const initials = (value: string) => value.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

export function ManagerAvatar({ avatar, name, className }: { avatar: string | null; name: string; className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarImage src={avatar ? `https://sleepercdn.com/avatars/thumbs/${avatar}` : undefined} alt="" />
      <AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

export function GradeBadge({ grade, className }: { grade: string; className?: string }) {
  return <Badge variant="outline" className={cn("font-semibold tabular-nums", gradeTone(grade), className)}>{grade}</Badge>;
}

/**
 * A surplus bar that grows from a centered zero, right for a gain and left for a loss.
 *
 * The number alone makes "+2,884" and "-1,682" hard to weigh against each other at a glance;
 * anchoring both to a shared midpoint turns the column into a distribution you can read down.
 */
export function SurplusBar({ surplus, scale }: { surplus: number; scale: number }) {
  const magnitude = scale > 0 ? Math.min(Math.abs(surplus) / scale, 1) : 0;
  const positive = surplus >= 0;
  return (
    <div aria-hidden="true" className="relative h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-muted">
      <div className="absolute inset-y-0 left-1/2 w-px bg-border" />
      <div
        className={cn("absolute inset-y-0 rounded-full", positive ? "bg-positive" : "bg-negative")}
        style={positive ? { left: "50%", width: `${magnitude * 50}%` } : { right: "50%", width: `${magnitude * 50}%` }}
      />
    </div>
  );
}

/**
 * Headshot for a drafted player, mirroring the treatment on roster and rankings rows.
 *
 * `DraftPickGrade` carries the Sleeper player id, so the thumbnail resolves without threading the
 * whole `NflPlayer` through the grading pipeline; the position initials cover pre-cache misses.
 */
export function PlayerHeadshot({ playerId, position, className }: { playerId: string; position: string | null; className?: string }) {
  return (
    <Avatar className={cn("bg-muted", className)}>
      <AvatarImage alt="" src={`https://sleepercdn.com/content/nfl/players/thumb/${playerId}.jpg`} />
      <AvatarFallback className="text-[0.6rem]">{position ?? "—"}</AvatarFallback>
    </Avatar>
  );
}

/**
 * A column header that sorts the table it heads.
 *
 * Sorting is the one interaction a grade table needs: the same rows answer "who drafted best",
 * "who swung most", and "who picked most" depending only on which column is active.
 */
export function SortHeader({ active, direction, onClick, align = "right", children }: { active: boolean; direction: "asc" | "desc"; onClick: () => void; align?: "left" | "right"; children: React.ReactNode }) {
  return (
    <button
      className={cn(
        "-mx-1 inline-flex w-full items-center gap-1 rounded px-1 py-0.5 text-xs font-medium uppercase tracking-wider transition-colors hover:text-foreground",
        align === "right" ? "justify-end" : "justify-start",
        active ? "text-foreground" : "text-muted-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      {children}
      <ChevronDownIcon
        aria-hidden="true"
        className={cn("size-3 transition-[transform,opacity]", active ? "opacity-100" : "opacity-0", active && direction === "asc" && "rotate-180")}
      />
    </button>
  );
}
