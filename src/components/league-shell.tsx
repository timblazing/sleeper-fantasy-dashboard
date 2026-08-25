import { AppBreadcrumb } from "@/components/app-breadcrumb";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteFooter } from "@/components/site-footer";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import type { LeagueChrome } from "@/lib/league-chrome";

// Shared by the [leagueId] layout and the connect screen, which renders the same
// chrome behind the dialog so the blurred backdrop is the real dashboard.
export function LeagueShell({ children, defaultOpen = true, league }: { children: React.ReactNode; defaultOpen?: boolean; league: LeagueChrome }) {
  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <AppSidebar league={league} />
      <SidebarInset>
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center md:h-16 gap-2 border-b border-border/60 bg-background/80 backdrop-blur-xl transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex w-full items-center gap-2 px-3 md:px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-vertical:h-4 data-vertical:self-auto" />
            <AppBreadcrumb league={league} />
          </div>
        </header>
        {children}
        <SiteFooter />
      </SidebarInset>
    </SidebarProvider>
  );
}
