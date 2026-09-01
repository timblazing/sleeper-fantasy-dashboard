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
import { LockIcon } from "lucide-react"
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
  // Only dynasty leagues are supported today, so non-dynasty options are shown but not selectable.
  const leagues = (account?.leagues ?? []).map((option) => ({
    name: option.name,
    plan: option.season,
    url: withUsername(`/${option.id}${suffix}`, username),
    logo: option.avatar ? leagueAvatarProxyUrl(option.avatar) : undefined,
    disabled: !option.isDynasty,
    disabledReason: `${option.type} leagues are not supported yet`,
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
        <NavProjects
          locked={
            league.isDynasty
              ? undefined
              : {
                  title: "Dynasty tools unavailable",
                  reason: "Trade values require a dynasty league.",
                  icon: <LockIcon />,
                }
          }
          projects={toItems(toolsNav.filter((entry) => league.isDynasty || !entry.dynastyOnly))}
        />
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
