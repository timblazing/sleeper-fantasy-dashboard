import { leagueAvatarUrl } from "@/lib/utils";

// Same-origin proxy for Sleeper avatars. Canvas background-keying (see `use-keyed-image`) needs
// pixel access, which a cross-origin image without CORS headers taints; serving the bytes from our
// own origin sidesteps that. Only bare avatar ids are accepted, so this can't be used as an open proxy.
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  if (!/^[a-f0-9]{1,64}$/i.test(id)) {
    return new Response("Invalid avatar id.", { status: 400 });
  }

  const upstream = await fetch(leagueAvatarUrl(id, "thumb"));
  if (!upstream.ok || !upstream.body) {
    return new Response("Avatar not found.", { status: 404 });
  }

  return new Response(upstream.body, {
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "image/png",
      // Avatars are immutable per id, so let the browser keep them.
      "cache-control": "public, max-age=86400, immutable",
    },
  });
}
