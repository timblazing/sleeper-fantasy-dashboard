"use client"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import type { LeagueChrome } from "@/lib/league-chrome"
import { navTitle } from "@/lib/nav"
import { withUsername } from "@/lib/utils"
import Link from "next/link"
import { useSearchParams, useSelectedLayoutSegment } from "next/navigation"

export function AppBreadcrumb({ league }: { league: LeagueChrome }) {
  const username = useSearchParams().get("username") ?? undefined
  const title = navTitle(useSelectedLayoutSegment())

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink
            render={<Link href={withUsername(`/${league.id}`, username)} />}
          >
            {league.name}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:block" />
        <BreadcrumbItem>
          <BreadcrumbPage>{title}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}
