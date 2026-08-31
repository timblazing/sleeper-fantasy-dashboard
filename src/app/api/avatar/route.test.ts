import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { leagueAvatarUrl } from "@/lib/utils";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
});

function request(id?: string) {
  const url = new URL("http://localhost/api/avatar");
  if (id !== undefined) url.searchParams.set("id", id);
  return new Request(url);
}

async function getRoute() {
  return import("@/app/api/avatar/route");
}

describe("GET /api/avatar", () => {
  it.each([undefined, "", "not-hex!", "a".repeat(65)]) ("rejects an invalid avatar ID (%s) without fetching", async (id) => {
    const { GET } = await getRoute();

    const response = await GET(request(id));

    expect(response.status).toBe(400);
    expect(await response.text()).toBe("Invalid avatar id.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("proxies a valid avatar with the upstream body and cache headers", async () => {
    fetchMock.mockResolvedValue(new Response("avatar-bytes", { headers: { "content-type": "image/jpeg" } }));
    const { GET } = await getRoute();

    const response = await GET(request("ABC123"));

    expect(fetchMock).toHaveBeenCalledWith(leagueAvatarUrl("ABC123", "thumb"));
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect(response.headers.get("cache-control")).toBe("public, max-age=86400, immutable");
    expect(await response.text()).toBe("avatar-bytes");
  });

  it("maps a non-OK upstream response to not found", async () => {
    fetchMock.mockResolvedValue(new Response("missing", { status: 404 }));
    const { GET } = await getRoute();

    const response = await GET(request("abc123"));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Avatar not found.");
  });

  it("maps an OK upstream response without a body to not found", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    const { GET } = await getRoute();

    const response = await GET(request("abc123"));

    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Avatar not found.");
  });
});
