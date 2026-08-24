"use client"

import * as React from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useKeyedImage } from "@/hooks/use-keyed-image"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { ChevronsUpDownIcon, LockIcon, TrophyIcon } from "lucide-react"
import Link from "next/link"

// The league logo, falling back to the trophy while it loads, when a league has none, or when
// the CDN 404s. The Avatar primitive owns that swap, so a broken image shows the trophy, not a gap.
// Logos are uploaded as JPEGs with their backdrop baked in, so `useKeyedImage` strips a flat
// background to transparency; until (or unless) that succeeds we show the untouched image.
function LeagueLogo({ src, className }: { src?: string; className?: string }) {
  const keyed = useKeyedImage(src)
  if (!src) return <TrophyIcon className={className} />
  return (
    <Avatar className="size-full rounded-[inherit] after:hidden">
      <AvatarImage alt="" src={keyed ?? src} className="rounded-[inherit] object-contain" />
      <AvatarFallback className="rounded-[inherit] bg-transparent text-inherit">
        <TrophyIcon className={className} />
      </AvatarFallback>
    </Avatar>
  )
}

export function TeamSwitcher({
  activeTeam,
  teams,
}: {
  activeTeam: { name: string; plan: string; logo?: string }
  teams: { name: string; plan: string; url: string; logo?: string; disabled?: boolean; disabledReason?: string }[]
}) {
  const { isMobile, setOpenMobile } = useSidebar()

  const trigger = (
    <>
      <div className="flex aspect-square size-8 shrink-0 items-center justify-center overflow-hidden rounded-lg text-sidebar-foreground">
        <LeagueLogo src={activeTeam.logo} />
      </div>
      <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
        <span className="truncate font-medium">{activeTeam.name}</span>
        <span className="truncate text-xs">{activeTeam.plan}</span>
      </div>
    </>
  )

  if (teams.length === 0) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg">{trigger}</SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
              />
            }
          >
            {trigger}
            <ChevronsUpDownIcon className="ml-auto group-data-[collapsible=icon]:hidden" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-fit"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs text-muted-foreground">
                Leagues
              </DropdownMenuLabel>
              {teams.map((team) => (
                <DropdownMenuItem
                  key={team.url}
                  className="gap-2 p-2"
                  disabled={team.disabled}
                  onClick={() => {
                    if (isMobile) setOpenMobile(false)
                  }}
                  // A disabled item stays inert text: rendering it as a link would still navigate.
                  render={team.disabled ? undefined : <Link href={team.url} />}
                >
                  <div className="flex size-6 items-center justify-center overflow-hidden rounded-md border">
                    {team.disabled ? <LockIcon className="size-4" /> : <LeagueLogo src={team.logo} className="size-4" />}
                  </div>
                  {team.name}
                  {team.disabled && team.disabledReason ? (
                    <span className="ml-auto pl-2 text-xs text-muted-foreground">
                      {team.disabledReason}
                    </span>
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
