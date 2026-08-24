import type { Metadata } from "next";
import { Overview } from "@/components/overview";
import { getOverviewData } from "@/lib/team-insights";

export const metadata: Metadata = { title: "Dashboard" };
export default async function LeaguePage({ params, searchParams }: { params: Promise<{ leagueId: string }>; searchParams: Promise<{ username?: string | string[] }> }) {
  const [{ leagueId }, query] = await Promise.all([params, searchParams]);
  const username = typeof query.username === "string" ? query.username : undefined;
  const data = await getOverviewData(leagueId, username);
  return <Overview data={data} />;
}
