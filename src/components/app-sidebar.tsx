"use client"

import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavProjects } from "@/components/nav-projects"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useAccount } from "@/hooks/use-account"
import type { LeagueChrome } from "@/lib/league-chrome"
import { mainNav, toolsNav, type NavEntry } from "@/lib/nav"
import { leagueAvatarProxyUrl, withUsername } from "@/lib/utils"
import { useSearchParams, useSelectedLayoutSegment } from "next/navigation"

export function AppSidebar({
  league,
  ...props
}: React.ComponentProps<typeof Sidebar> & { league: LeagueChrome }) {
  const activeSegment = useSelectedLayoutSegment()
  const username = useSearchParams().get("username") ?? undefined
  const account = useAccount(username)

  const toItems = (entries: NavEntry[]) =>
    entries.map(({ title, segment, icon: Icon }) => ({
      title,
      url: withUsername(
        `/${league.id}${segment ? `/${segment}` : ""}${segment === "matchups" ? `/${league.matchupWeek}` : ""}`,
        username
      ),
      icon: <Icon />,
      isActive: activeSegment === segment,
    }))

  // Switching leagues keeps you on the same tab; the matchup week resets to the new league's.
  const suffix = activeSegment
    ? `/${activeSegment}${activeSegment === "matchups" ? `/${league.matchupWeek}` : ""}`
    : ""
  // Every format is selectable. What changes between them is the currency the numbers are quoted
  // in (see `src/lib/value-basis.ts`), not which leagues the app will open — so the switcher
  // labels each option with its format rather than locking it.
  const leagues = (account?.leagues ?? []).map((option) => ({
    name: option.name,
    plan: option.type,
    url: withUsername(`/${option.id}${suffix}`, username),
    logo: option.avatar ? leagueAvatarProxyUrl(option.avatar) : undefined,
  }))

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher
          activeTeam={{
            name: league.name,
            plan: `${league.season} · ${league.type}`,
            logo: league.avatar ? leagueAvatarProxyUrl(league.avatar) : undefined,
          }}
          teams={leagues}
        />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={toItems(mainNav)} />
        <NavProjects projects={toItems(toolsNav)} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: account?.displayName ?? username ?? "Sleeper",
            avatar: account?.avatar
              ? `https://sleepercdn.com/avatars/thumbs/${account.avatar}`
              : "",
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
