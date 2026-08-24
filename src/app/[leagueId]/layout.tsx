import { LeagueShell } from "@/components/league-shell";
import type { Metadata } from "next";
import { RememberAccount } from "@/components/remember-account";
import { getLeagueChrome } from "@/lib/league-chrome";
import { leagueAvatarUrl } from "@/lib/utils";
import { isLeagueId } from "@/lib/league-id";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

// The tab icon is the league's own avatar, so several leagues open side by side stay tellable
// apart. Leagues without one (and every page outside this segment) fall back to `app/icon.svg`,
// which is only reached by NOT emitting an `icons` field here — an empty array would suppress it.
export async function generateMetadata({ params }: LayoutProps<"/[leagueId]">): Promise<Metadata> {
  const { leagueId } = await params;
  if (!isLeagueId(leagueId)) return {};
  const { avatar } = await getLeagueChrome(leagueId);
  return avatar ? { icons: { icon: [{ url: leagueAvatarUrl(avatar) }] } } : {};
}

// The shell lives here rather than in each page so navigating between tabs (and the
// loading.tsx skeleton) only swaps the inset content — the sidebar never unmounts.
export default async function LeagueLayout({ children, params }: LayoutProps<"/[leagueId]">) {
  const [{ leagueId }, cookieStore] = await Promise.all([params, cookies()]);
  if (!isLeagueId(leagueId)) notFound();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";
  const league = await getLeagueChrome(leagueId);

  return (
    <LeagueShell defaultOpen={defaultOpen} league={league}>
      <RememberAccount leagueId={leagueId} />
      {children}
    </LeagueShell>
  );
}
