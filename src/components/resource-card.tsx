import { ArrowUpRightIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ResourceStatus } from "@/lib/resources/data";

const STATUS_LABEL: Record<ResourceStatus, string> = {
  integrated: "Integrated",
  free: "Free",
  free_tier: "Free tier",
  paid: "Paid",
  scrape_required: "Scrape required",
  outdated: "Verify",
};

// Status is advisory, so these lean on hue rather than the semantic tokens:
// "paid" is not a destructive action and "integrated" is not a success state.
const STATUS_CLASS: Record<ResourceStatus, string> = {
  integrated: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  free: "bg-muted text-muted-foreground",
  free_tier: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  paid: "bg-orange-500/15 text-orange-700 dark:text-orange-300",
  scrape_required: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
  outdated: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
};

function hostOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export type ResourceCardItem = {
  name: string;
  url: string;
  note?: string;
  status?: ResourceStatus[];
};

/**
 * One entry in the resources directory. `featured` pins the brand treatment used
 * for the "use these first" row; everything else is a plain card.
 */
export function ResourceCard({
  featured = false,
  resource,
}: {
  featured?: boolean;
  resource: ResourceCardItem;
}) {
  return (
    <li className="h-full min-w-0">
      <Card
        className={cn(
          "h-full min-w-0 transition-colors",
          featured ? "bg-primary/5 ring-2 ring-primary/40" : "hover:ring-foreground/20",
        )}
        size="sm"
      >
        <CardContent className="flex h-full flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <a
              className={cn(
                "min-w-0 flex-1 break-words font-semibold hover:underline",
                featured ? "text-base text-primary" : "text-sm text-foreground",
              )}
              href={resource.url}
              rel="noopener noreferrer"
              target="_blank"
            >
              {resource.name}
              <ArrowUpRightIcon className="ml-1 inline size-3 align-baseline opacity-60" />
            </a>
            {resource.status && resource.status.length > 0 && (
              <div className="flex shrink-0 flex-wrap justify-end gap-1">
                {resource.status.map((status) => (
                  <Badge
                    key={status}
                    className={cn(
                      "text-[10px] font-semibold tracking-wide uppercase",
                      STATUS_CLASS[status],
                    )}
                  >
                    {STATUS_LABEL[status]}
                  </Badge>
                ))}
              </div>
            )}
          </div>
          <span className="font-mono text-xs text-muted-foreground">{hostOf(resource.url)}</span>
          {resource.note && (
            <p className="text-xs leading-relaxed text-muted-foreground">{resource.note}</p>
          )}
        </CardContent>
      </Card>
    </li>
  );
}
