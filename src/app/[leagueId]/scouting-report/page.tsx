import type { Metadata } from "next";

import { ScoutingReportView } from "@/components/scouting-report";
import { getScoutingReport } from "@/lib/scouting-report";

export const metadata: Metadata = { title: "Scouting Report" };

export default async function ScoutingReportPage({ params, searchParams }: { params: Promise<{ leagueId: string }>; searchParams: Promise<{ username?: string | string[] }> }) {
  const [{ leagueId }, query] = await Promise.all([params, searchParams]);
  const username = typeof query.username === "string" ? query.username : undefined;
  const report = await getScoutingReport(leagueId, username);
  return <ScoutingReportView report={report} />;
}
