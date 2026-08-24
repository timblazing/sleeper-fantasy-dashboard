import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function withUsername(path: string, username?: string) {
  if (!username) return path

  const separator = path.includes("?") ? "&" : "?"
  return `${path}${separator}username=${encodeURIComponent(username)}`
}

export function points(whole = 0, hundredths = 0) {
  return whole + hundredths / 100
}

// Sleeper serves league avatars from the same CDN as user avatars. The full-size image backs the
// favicon (browsers downscale it themselves); `thumbs/` is the 40px cut the sidebar badge uses.
// This lives here rather than beside `LeagueChrome` because the client sidebar calls it, and
// `lib/league-chrome` reaches `lib/sleeper`, which is `server-only`.
export function leagueAvatarUrl(avatar: string, size: "full" | "thumb" = "full") {
  return `https://sleepercdn.com/avatars/${size === "thumb" ? "thumbs/" : ""}${avatar}`
}

// The same thumbnail, served from our own origin so the sidebar can read its pixels on a canvas to
// key out the baked-in backdrop — see `hooks/use-keyed-image` and `app/api/avatar/route`.
export function leagueAvatarProxyUrl(avatar: string) {
  return `/api/avatar?id=${encodeURIComponent(avatar)}`
}
