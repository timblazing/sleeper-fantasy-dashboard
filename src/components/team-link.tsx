import type { ReactNode } from "react";
import Link from "next/link";
import { cn, withUsername } from "@/lib/utils";

/** A roster-aware team name link that preserves the connected username in the URL. */
export function TeamLink({ children, className, leagueId, rosterId, username }: { children: ReactNode; className?: string; leagueId: string; rosterId: number | null; username?: string }) {
  if (rosterId === null) return <span className={className}>{children}</span>;
  return <Link className={cn("hover:underline", className)} href={withUsername(`/${leagueId}/teams/${rosterId}`, username)}>{children}</Link>;
}
