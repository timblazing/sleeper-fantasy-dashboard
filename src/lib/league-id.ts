// Guards a league id before it reaches upstream URL paths, Redis key names, and
// server-side redirects — see plan 003 for the sinks this closes.

/**
 * Real Sleeper league ids are numeric snowflakes, but this is deliberately looser than
 * `^[0-9]+$`: that would hard-code an undocumented upstream format we don't control, and a
 * format change would 404 every league at once instead of degrading. This character class is
 * the security boundary — it excludes `/`, `:`, `.`, `?`, `#`, `%`, and whitespace, which is
 * exactly what keeps upstream URL paths, Redis cache keys, and server-side redirects safe. The
 * length cap bounds cache-key size. Do not loosen this without re-reading plan 003.
 */
export function isLeagueId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,64}$/.test(value);
}
