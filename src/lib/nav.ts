import { AmbulanceIcon, BinocularsIcon, BookOpenIcon, ClipboardListIcon, LayoutDashboardIcon, ScaleIcon, TrophyIcon, UsersIcon, type LucideIcon } from "lucide-react";

// `segment` matches what useSelectedLayoutSegment() reports under the [leagueId] layout;
// null is the index route (Dashboard).
// `dynastyOnly` entries need trade values, which only exist for dynasty leagues;
// the sidebar drops them and explains the gap. Everything else always renders —
// including the injury report, which reads only rosters and Sleeper's player catalog.
export type NavEntry = { title: string; segment: string | null; icon: LucideIcon; dynastyOnly?: boolean };

export const mainNav: NavEntry[] = [
  { title: "Dashboard", segment: null, icon: LayoutDashboardIcon },
  { title: "League", segment: "league", icon: TrophyIcon },
  { title: "Players", segment: "players", icon: UsersIcon },
  { title: "Draft", segment: "draft", icon: ClipboardListIcon },
];

export const toolsNav: NavEntry[] = [
  { title: "Trade Calculator", segment: "trade", icon: ScaleIcon, dynastyOnly: true },
  { title: "Scouting Report", segment: "scouting-report", icon: BinocularsIcon },
  { title: "Injury Report", segment: "injuries", icon: AmbulanceIcon },
  { title: "Resources", segment: "resources", icon: BookOpenIcon },
];

export function navTitle(segment: string | null): string {
  if (segment === "matchups") return "Matchups";
  if (segment === "teams") return "Team";
  return [...mainNav, ...toolsNav].find((entry) => entry.segment === segment)?.title ?? "Dashboard";
}
