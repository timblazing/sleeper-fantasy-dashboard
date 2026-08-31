import { afterEach, describe, expect, it, vi } from "vitest";

const account = {
  userId: "user-1",
  username: "clay",
  displayName: "Clay",
  avatar: null,
  leagues: [{ id: "league-1", name: "Test League", season: "2026", status: "in_season", type: "Dynasty", isDynasty: true, avatar: null }],
};

afterEach(() => {
  vi.doUnmock("@/lib/sleeper");
  vi.resetModules();
});

function request(url = "http://localhost/api/leagues") {
  return new Request(url);
}

async function getRoute(lookup = vi.fn()) {
  vi.doMock("@/lib/sleeper", () => ({ getNflLeaguesForUsername: lookup }));
  const { GET } = await import("@/app/api/leagues/route");
  return { GET, lookup };
}

describe("GET /api/leagues", () => {
  it("rejects a missing username without calling Sleeper", async () => {
    const { GET, lookup } = await getRoute();

    const response = await GET(request());

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Enter a valid Sleeper username." });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("rejects a username longer than 50 characters without calling Sleeper", async () => {
    const { GET, lookup } = await getRoute();

    const response = await GET(request(`http://localhost/api/leagues?username=${"a".repeat(51)}`));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Enter a valid Sleeper username." });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("returns a successful account", async () => {
    const lookup = vi.fn().mockResolvedValue(account);
    const { GET } = await getRoute(lookup);

    const response = await GET(request("http://localhost/api/leagues?username=%20clay%20"));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(account);
    expect(lookup).toHaveBeenCalledWith("clay");
  });

  it("maps an account with no leagues to the existing not-found response", async () => {
    const emptyAccount = { ...account, leagues: [] };
    const lookup = vi.fn().mockResolvedValue(emptyAccount);
    const { GET } = await getRoute(lookup);

    const response = await GET(request("http://localhost/api/leagues?username=clay"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "No NFL leagues were found for clay this season." });
  });

  it("returns the classifier's not-found response", async () => {
    const lookup = vi.fn().mockRejectedValue(new Error("Sleeper user not found"));
    const { GET } = await getRoute(lookup);

    const response = await GET(request("http://localhost/api/leagues?username=clay"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "We couldn't find that Sleeper username. Check the spelling and try again." });
  });

  it("returns the classifier's unavailable response", async () => {
    const lookup = vi.fn().mockRejectedValue(new Error("The current NFL season is unavailable"));
    const { GET } = await getRoute(lookup);

    const response = await GET(request("http://localhost/api/leagues?username=clay"));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Sleeper is unavailable right now. This isn't your username — try again in a few minutes." });
  });
});
