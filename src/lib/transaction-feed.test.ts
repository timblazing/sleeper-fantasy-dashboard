import { describe, expect, it, vi } from "vitest";
import { makePlayer, makeRoster, makeSource, makeState, makeTransaction, makeUser } from "@/lib/test/fixtures";
import { getTransactionFeed, transactionKind, transactionLabel } from "@/lib/transaction-feed";
import type { TransactionEntry } from "@/lib/types";

const catalog = new Map([["p1", makePlayer({ id: "p1", name: "Added Player" })], ["p2", makePlayer({ id: "p2", name: "Dropped Player" })]]);

const source = (byWeek: Record<number, ReturnType<typeof makeTransaction>[]>, week = 3) =>
  makeSource({
    getNflState: async () => makeState({ week }),
    getLeagueUsers: async () => [makeUser({ user_id: "U1", metadata: { team_name: "Team One" } })],
    getLeagueRosters: async () => [makeRoster({ roster_id: 1, owner_id: "U1" })],
    getPlayerCatalog: async () => catalog,
    getTransactions: async (_id: string, requested: number) => byWeek[requested] ?? [],
  });

describe("getTransactionFeed", () => {
  it("walks weeks backwards, keeps only completed moves, and resolves team names", async () => {
    const feed = await getTransactionFeed("L1", 40, source({
      3: [makeTransaction({ transaction_id: "new", created: 300, adds: { p1: 1 }, drops: { p2: 1 } })],
      2: [makeTransaction({ transaction_id: "pending", status: "failed", created: 200 })],
      1: [makeTransaction({ transaction_id: "old", created: 100 })],
    }));
    expect(feed.map((entry) => entry.id)).toEqual(["new", "old"]);
    expect(feed[0].sides[0].teamName).toBe("Team One");
    expect(feed[0].sides[0].adds.map((player) => player.name)).toEqual(["Added Player"]);
    expect(feed[0].sides[0].drops.map((player) => player.name)).toEqual(["Dropped Player"]);
  });

  it("stops scanning earlier weeks once the limit is reached", async () => {
    const getTransactions = vi.fn(async (_id: string, week: number) => [makeTransaction({ transaction_id: `w${week}`, created: week })]);
    await getTransactionFeed("L1", 1, makeSource({ getNflState: async () => makeState({ week: 5 }), getTransactions }));
    expect(getTransactions).toHaveBeenCalledTimes(1);
    expect(getTransactions).toHaveBeenCalledWith("L1", 5);
  });

  it("skips a week whose transactions cannot be read", async () => {
    const feed = await getTransactionFeed("L1", 40, makeSource({
      getNflState: async () => makeState({ week: 2 }),
      getTransactions: async (_id: string, week: number) => { if (week === 2) throw new Error("down"); return [makeTransaction({ transaction_id: "w1" })]; },
    }));
    expect(feed.map((entry) => entry.id)).toEqual(["w1"]);
  });
});

const entry = (type: TransactionEntry["type"], adds: string[], drops: string[]): TransactionEntry => ({
  id: "t1", type, status: "complete", week: 1, created: 1, time: "1m ago", bid: null,
  sides: [{ rosterId: 1, teamName: "Team One", adds: adds.map((name) => makePlayer({ name })), drops: drops.map((name) => makePlayer({ name })), picks: [], faab: null }],
});

describe("transactionLabel", () => {
  it("names a free agent drop by what moved, not by the transaction type", () => {
    expect(transactionLabel(entry("free_agent", [], ["Dont'e Thornton"]))).toBe("Free agent drop");
  });

  it("still names a free agent add an add", () => {
    expect(transactionLabel(entry("free_agent", ["Keenan Allen"], []))).toBe("Free agent add");
  });

  it("keeps waiver claims and trades on their own labels", () => {
    expect(transactionLabel(entry("waiver", [], ["Someone"]))).toBe("Waiver claim");
    expect(transactionLabel(entry("trade", [], []))).toBe("Trade");
  });
});

describe("transactionKind", () => {
  it("maps each move onto one of the three feed icons", () => {
    expect(transactionKind(entry("free_agent", ["In"], []))).toBe("add");
    expect(transactionKind(entry("free_agent", [], ["Out"]))).toBe("drop");
    expect(transactionKind(entry("trade", [], []))).toBe("trade");
  });

  it("reads a waiver claim that swaps a player as an add", () => {
    expect(transactionKind(entry("waiver", ["In"], ["Out"]))).toBe("add");
  });
});
