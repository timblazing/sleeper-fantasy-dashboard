import type { Metadata } from "next";
import { DynastyRequired } from "@/components/dynasty-required";
import { PageHeader } from "@/components/page-header";
import { TradeCalculator } from "@/components/trade-calculator";
import { getTradeLabData } from "@/lib/trade-lab";

export const metadata: Metadata = { title: "Trade Calculator" };

export default async function TradePage({ params, searchParams }: { params: Promise<{ leagueId: string }>; searchParams: Promise<{ username?: string | string[] }> }) {
  const [{ leagueId }, query] = await Promise.all([params, searchParams]);
  const data = await getTradeLabData(leagueId, typeof query.username === "string" ? query.username : undefined);
  if (!data.league.isDynasty) {
    return <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 p-4 md:p-6 lg:p-8">
      <PageHeader description="Stage both sides of a deal and grade it against live market values." title="Trade Calculator" />
      <DynastyRequired feature="Trade Calculator" leagueId={leagueId} />
    </div>;
  }
  return <TradeCalculator data={data} />;
}
