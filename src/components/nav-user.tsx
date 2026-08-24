"use client"

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import { forgetAccount } from "@/lib/account-storage"
import { ChevronsUpDownIcon, LogOutIcon } from "lucide-react"
import { useRouter } from "next/navigation"

export function NavUser({
  user,
}: {
  user: {
    name: string
    avatar: string
  }
}) {
  const { isMobile } = useSidebar()
  const router = useRouter()
  const initials = user.name.slice(0, 2).toUpperCase()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />
            }
          >
            <Avatar>
              <AvatarImage src={user.avatar} alt="" />
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1 truncate text-left text-sm font-medium">{user.name}</span>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-fit"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    <AvatarImage src={user.avatar} alt="" />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate font-medium">{user.name}</span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                // Without clearing the remembered account, `/` would just send you back.
                forgetAccount()
                router.push("/")
              }}
            >
              <LogOutIcon />
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
