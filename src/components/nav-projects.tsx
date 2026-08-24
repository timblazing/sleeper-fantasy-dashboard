"use client"

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import Link from "next/link"

export function NavProjects({
  projects,
  locked,
}: {
  projects: {
    title: string
    url: string
    icon?: React.ReactNode
    isActive?: boolean
  }[]
  locked?: {
    title: string
    reason: string
    icon?: React.ReactNode
  }
}) {
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Tools</SidebarGroupLabel>
      <SidebarMenu>
        {projects.map((item) => (
          <SidebarMenuItem key={item.title}>
            <SidebarMenuButton
              isActive={item.isActive}
              tooltip={item.title}
              onClick={() => {
                if (isMobile) setOpenMobile(false)
              }}
              render={<Link href={item.url} />}
            >
              {item.icon}
              <span>{item.title}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
        {locked ? (
          <SidebarMenuItem>
            <Tooltip>
              <TooltipTrigger render={<SidebarMenuButton aria-disabled="true" />}>
                {locked.icon}
                <span>{locked.title}</span>
              </TooltipTrigger>
              <TooltipContent align="center" side="right">
                {locked.reason}
              </TooltipContent>
            </Tooltip>
          </SidebarMenuItem>
        ) : null}
      </SidebarMenu>
    </SidebarGroup>
  )
}
