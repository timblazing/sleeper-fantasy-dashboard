import { Button } from "@/components/ui/button";

/** Vendor terms (rosteraudit-api-reference.md §6): any surface showing RosterAudit values
 *  links back. Rendered once by the [leagueId] layout so every page carries the credit,
 *  rather than each page opting in with its own response-provided attribution. */
export function SiteFooter() {
  return (
    <footer className="mt-auto flex items-center justify-center px-4 py-3 text-xs text-muted-foreground">
      Data by Sleeper · <Button nativeButton={false} className="px-1" size="xs" variant="link" render={<a href="https://rosteraudit.com" rel="noreferrer" target="_blank" />}>Values by RosterAudit</Button>
    </footer>
  );
}
