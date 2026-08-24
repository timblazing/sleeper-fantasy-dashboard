import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";

/** Vendor terms (rosteraudit-api-reference.md §6): any surface showing RosterAudit values
 *  links back. Render the response-provided text and URL; plan 002's client already
 *  supplies the "Values by RosterAudit.com" fallback when a response omits them. */
export function Attribution({ text, url }: { text: string; url: string }) {
  return <CardFooter className="justify-center border-t-0 bg-transparent py-2 text-xs text-muted-foreground">Data by Sleeper · <Button nativeButton={false} className="px-1" size="xs" variant="link" render={<a href={url} rel="noreferrer" target="_blank" />}>{text}</Button></CardFooter>;
}
