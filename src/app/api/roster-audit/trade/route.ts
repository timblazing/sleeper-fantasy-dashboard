import { z } from "zod";
import { evaluateTrade } from "@/lib/trade-lab";
import type { RaError } from "@/lib/roster-audit";

const assetSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("player"), id: z.string().min(1).max(32) }),
  z.object({ type: z.literal("pick"), season: z.number().int().min(2000).max(2100), round: z.number().int().min(1).max(7), slot: z.enum(["early", "mid", "late"]) }),
]);

// A side cap keeps one request from turning into an unbounded upstream payload; no real
// dynasty trade needs more than this, and /trade/calculate is the only rate-limited endpoint.
const sideSchema = z.array(assetSchema).min(1).max(12);
const requestSchema = z.object({ leagueId: z.string().min(1).max(32), sideA: sideSchema, sideB: sideSchema });

/** Upstream failures map to statuses the client can act on; only the message is user-facing. */
function describe(error: RaError): { status: number; message: string } {
  switch (error.kind) {
    case "missing-key":
    case "rejected-key":
      return { status: 503, message: "The trade calculator needs a RosterAudit API key on the server." };
    case "rate-limited":
      return { status: 429, message: "RosterAudit's trade limit was reached. Try again in a few minutes." };
    case "invalid-response":
      return { status: 502, message: "RosterAudit returned a trade result this app could not read." };
    default:
      return { status: 503, message: "RosterAudit is unavailable right now." };
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Add at least one player or pick to both sides of the trade." }, { status: 400 });
  }

  const { leagueId, sideA, sideB } = parsed.data;
  let result;
  try {
    result = await evaluateTrade(leagueId, sideA, sideB);
  } catch {
    return Response.json({ error: "This league could not be read from Sleeper." }, { status: 503 });
  }

  if (!result.ok) {
    const { status, message } = describe(result.error);
    return Response.json({ error: message }, { status });
  }
  return Response.json({ trade: result.data, attribution: result.attribution });
}
