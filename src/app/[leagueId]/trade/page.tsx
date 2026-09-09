import type { Metadata } from "next";
import { TradeCalculator } from "@/components/trade-calculator";
import { getTradeLabData } from "@/lib/trade-lab";

export const metadata: Metadata = { title: "Trade Calculator" };

export default async function TradePage({ params, searchParams }: { params: Promise<{ leagueId: string }>; searchParams: Promise<{ username?: string | string[] }> }) {
  const [{ leagueId }, query] = await Promise.all([params, searchParams]);
  const data = await getTradeLabData(leagueId, typeof query.username === "string" ? query.username : undefined);
  return <TradeCalculator data={data} />;
}
