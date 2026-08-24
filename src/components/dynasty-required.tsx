import Link from "next/link";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export function DynastyRequired({ feature, leagueId }: { feature: string; leagueId: string }) {
  return <Card><CardContent><Empty className="min-h-72"><EmptyHeader><EmptyMedia variant="icon"><Lock /></EmptyMedia><EmptyTitle>{feature} needs a dynasty league</EmptyTitle><EmptyDescription>This league is not a dynasty league, so {feature} is unavailable. Dynasty values only apply to leagues that carry rosters across seasons.</EmptyDescription></EmptyHeader><EmptyContent><Link className="text-sm underline underline-offset-4 hover:text-primary" href={`/${leagueId}`}>Back to league overview</Link></EmptyContent></Empty></CardContent></Card>;
}
