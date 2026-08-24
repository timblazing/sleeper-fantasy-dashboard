import type { Metadata } from "next";
import { BandageIcon, HeartPulse } from "lucide-react";
import { InjuryReportTable } from "@/components/injury-report";
import { InjuryToolbar } from "@/components/injury-toolbar";
import { PageHeader } from "@/components/page-header";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { parseInjuryQuery, type InjurySearchParams } from "@/lib/injury-query";
import { getInjuryReport, selectInjuryEntries } from "@/lib/injury-report";

export const metadata: Metadata = { title: "Injury Report" };

const DESCRIPTION = "Every injury and practice designation across rostered players, ranked by who it actually costs.";

export default async function InjuriesPage({ params, searchParams }: { params: Promise<{ leagueId: string }>; searchParams: Promise<InjurySearchParams> }) {
  const [{ leagueId }, rawQuery] = await Promise.all([params, searchParams]);
  const query = parseInjuryQuery(rawQuery);
  const report = await getInjuryReport(leagueId);
  // Filtering is a server-side read of the URL, matching the Players page: the view a reader
  // shares is the view their teammate sees.
  const entries = selectInjuryEntries(report, query);

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8">
      <PageHeader description={DESCRIPTION} title="Injury Report" />

      {!report.catalogReady ? (
        <Empty className="min-h-64 border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><BandageIcon /></EmptyMedia>
            <EmptyTitle>Injury data unavailable</EmptyTitle>
            <EmptyDescription>Sleeper did not return its player injury report. Try again shortly.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : report.entries.length ? (
        <>
          <InjuryToolbar leagueId={leagueId} query={query} />
          <InjuryReportTable entries={entries} leagueId={leagueId} query={query} report={report} />
        </>
      ) : (
        <Empty className="min-h-64 border">
          <EmptyHeader>
            <EmptyMedia variant="icon"><HeartPulse /></EmptyMedia>
            <EmptyTitle>Nobody is hurt</EmptyTitle>
            <EmptyDescription>Sleeper is not reporting an injury or practice designation for any rostered player in this league.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
