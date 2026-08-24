import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { ResourceCard } from "@/components/resource-card";
import { Button } from "@/components/ui/button";
import { getLeagueChrome } from "@/lib/league-chrome";
import { CATEGORIES, REDDITORS, RESOURCES } from "@/lib/resources/data";
import {
  RESOURCE_FORMAT_LABEL,
  defaultFormatForLeague,
  isResourceFormat,
  type ResourceFormat,
} from "@/lib/resources/formats";
import { withUsername } from "@/lib/utils";

export const metadata: Metadata = { title: "Resources" };

const FORMAT_TABS = ["dynasty", "redraft", "guillotine"] as const;

export default async function ResourcesPage({
  params,
  searchParams,
}: {
  params: Promise<{ leagueId: string }>;
  searchParams: Promise<{ format?: string; username?: string }>;
}) {
  const [{ leagueId }, query] = await Promise.all([params, searchParams]);
  const league = await getLeagueChrome(leagueId);

  const { format, username } = query;

  // No `format` in the URL means "not chosen yet", so the league's own format is
  // the default rather than the unfiltered list — a redraft manager should never
  // have to opt out of dynasty trade charts. `?format=all` is the explicit escape.
  const active: ResourceFormat | null =
    format === "all" ? null : isResourceFormat(format) ? format : defaultFormatForLeague(league.type);

  const href = (value: ResourceFormat | "all") =>
    withUsername(`/${leagueId}/resources?format=${value}`, username);

  // An empty `formats` array means the resource is not tied to a league format
  // (survivor pool tools, for example); those surface only under All.
  const matches = (formats: ResourceFormat[]) => active === null || formats.includes(active);

  const visible = RESOURCES.filter((r) => matches(r.formats));
  const visibleRedditors = REDDITORS.filter((u) => matches(u.formats));
  const featured = visible.filter((r) => r.featured);
  const countFor = (value: ResourceFormat) =>
    RESOURCES.filter((r) => r.formats.includes(value)).length +
    REDDITORS.filter((u) => u.formats.includes(value)).length;

  const sections = CATEGORIES.map((category) => ({
    category,
    items: visible.filter((r) => r.category === category.key && !r.featured),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-8 p-4 md:p-6 lg:p-8">
      <PageHeader description="Tools, rankings, and analysis worth bookmarking, filtered to your league format." title="Resources" />

      <div className="flex flex-wrap items-center gap-2">
          <Button
            nativeButton={false}
            size="lg"
            variant={active === null ? "default" : "outline"}
            render={<Link href={href("all")} />}
          >
            All
            <span className="text-xs tabular-nums opacity-60">
              {RESOURCES.length + REDDITORS.length}
            </span>
          </Button>
          {FORMAT_TABS.map((value) => (
            <Button
              key={value}
              nativeButton={false}
              size="lg"
              variant={active === value ? "default" : "outline"}
              render={<Link href={href(value)} />}
            >
              {RESOURCE_FORMAT_LABEL[value]}
              <span className="text-xs tabular-nums opacity-60">{countFor(value)}</span>
            </Button>
          ))}
      </div>

      {featured.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold tracking-wider text-primary uppercase">
            Use these first
          </h2>
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {featured.map((resource) => (
              <ResourceCard key={resource.url} featured resource={resource} />
            ))}
          </ul>
        </section>
      )}

      {sections.length > 0 && (
        <nav aria-label="Jump to category" className="flex flex-wrap gap-2">
          {sections.map(({ category }) => (
            <Button key={category.key} nativeButton={false} render={<a href={`#${category.key}`} />} size="sm" variant="secondary">
              {category.title}
            </Button>
          ))}
          {visibleRedditors.length > 0 && (
            <Button nativeButton={false} render={<a href="#redditors" />} size="sm" variant="secondary">
              Redditors
            </Button>
          )}
        </nav>
      )}

      {sections.map(({ category, items }) => (
        <section key={category.key} id={category.key} className="flex scroll-mt-24 flex-col gap-3">
          <header className="flex flex-col gap-0.5">
            <h2 className="text-lg font-semibold tracking-tight">{category.title}</h2>
            {category.blurb && <p className="text-sm text-muted-foreground">{category.blurb}</p>}
          </header>
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {items.map((resource) => (
              <ResourceCard key={resource.url} resource={resource} />
            ))}
          </ul>
        </section>
      ))}

      {visibleRedditors.length > 0 && (
        <section id="redditors" className="flex scroll-mt-24 flex-col gap-3">
          <header className="flex flex-col gap-0.5">
            <h2 className="text-lg font-semibold tracking-tight">Redditors</h2>
            <p className="text-sm text-muted-foreground">
              People worth following for analysis and rookie content.
            </p>
          </header>
          <ul className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {visibleRedditors.map((redditor) => (
              <ResourceCard
                key={redditor.handle}
                resource={{
                  name: redditor.handle,
                  url: redditor.url,
                  note: redditor.posts,
                  status: redditor.status,
                }}
              />
            ))}
          </ul>
        </section>
      )}

      {visible.length === 0 && visibleRedditors.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Nothing is tagged for this format yet.{" "}
          <Link className="text-primary hover:underline" href={href("all")}>
            Show every resource
          </Link>
          .
        </p>
      )}
    </div>
  );
}
